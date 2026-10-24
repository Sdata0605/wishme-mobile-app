import React, { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

interface Props {
  videoId: string;
  /** Seconds into the video to start and stop; the whole video when left out. */
  start?: number;
  end?: number;
  onReady?: () => void;
  onEnded: () => void;
  /** The owner does not allow the video to play inside apps, or it could not load. */
  onError: (code: number) => void;
  onProgress?: (fraction: number) => void;
}

/**
 * A celebrity's original clip, played straight from its official YouTube upload inside a WebView with the IFrame
 * Player API: no controls, autoplay with sound, and messages back to the screen for ready / progress / ended / error.
 * Playing the owner's own upload keeps the clip legal: nothing is copied, the owner keeps the views.
 */
export function YouTubeMoment({ videoId, start, end, onReady, onEnded, onError, onProgress }: Props) {
  const done = useRef(false);

  const html = useMemo(() => {
    const vars = {
      // cc_load_policy 3 keeps YouTube's caption track off; the clip's own burnt-in subtitles are untouched.
      autoplay: 1, controls: 0, playsinline: 1, rel: 0, modestbranding: 1, fs: 0, iv_load_policy: 3, cc_load_policy: 3, disablekb: 1,
      ...(start !== undefined ? { start: Math.floor(start) } : {}),
      ...(end !== undefined ? { end: Math.ceil(end) } : {}),
    };
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
html,body{margin:0;padding:0;background:transparent;height:100%;overflow:hidden}
/* Reels framing: the player always covers the whole phone screen, centred. A vertical Short fits exactly; a 16:9
   video is scaled to the screen's height, so its sides fall off the edges instead of leaving black bars. */
#p{position:absolute;top:50%;left:50%;width:100vw;height:100vh;min-width:177.78vh;min-height:56.25vw;transform:translate(-50%,-50%)}
</style></head><body><div id="p"></div>
<script>
var S=function(t,d){if(t!=='time')console.log('[moment] '+t+' '+JSON.stringify(d===undefined?null:d));try{window.ReactNativeWebView.postMessage(JSON.stringify({t:t,d:d}))}catch(e){}};
window.onerror=function(m){S('jserror',String(m))};
var tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';
tag.onerror=function(){S('error',-1)};document.head.appendChild(tag);
var player,base=${JSON.stringify(start ?? 0)},stop=${JSON.stringify(end ?? null)};
function onYouTubeIframeAPIReady(){
  player=new YT.Player('p',{videoId:${JSON.stringify(videoId)},playerVars:${JSON.stringify(vars)},events:{
    onReady:function(e){try{e.target.unloadModule('captions');e.target.unloadModule('cc')}catch(x){}e.target.unMute();e.target.setVolume(100);e.target.playVideo();S('ready')},
    onStateChange:function(e){if(e.data===0)S('ended');if(e.data===1){try{e.target.unloadModule('captions');e.target.unloadModule('cc')}catch(x){}S('playing')}},
    onError:function(e){S('error',e.data)}
  }});
}
setInterval(function(){
  if(!player||!player.getCurrentTime)return;
  var t=player.getCurrentTime(),d=player.getDuration();
  var to=stop!==null?stop:d;
  if(d>0)S('time',Math.max(0,Math.min(1,(t-base)/(to-base))));
},250);
setTimeout(function(){if(!player)S('error',-2)},12000);
</script></body></html>`;
  }, [videoId, start, end]);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { t: string; d?: unknown };
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.t === 'jserror') return;
    if (msg.t === 'ready' || msg.t === 'playing') onReady?.();
    else if (msg.t === 'time' && typeof msg.d === 'number') onProgress?.(msg.d);
    else if (msg.t === 'ended' && !done.current) { done.current = true; onEnded(); }
    else if (msg.t === 'error' && !done.current) { done.current = true; onError(typeof msg.d === 'number' ? msg.d : -1); }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <WebView
        // The Referer YouTube wants comes from baseUrl; without one the player refuses with error 153. Any https
        // page origin will do; YouTube's own domain is not accepted as the embedding page.
        source={{ html, baseUrl: 'https://localhost/' }}
        originWhitelist={['*']}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={false}
        scrollEnabled={false}
        bounces={false}
        setSupportMultipleWindows={false}
        onMessage={onMessage}
        onError={(e) => { console.log('[moment] webview error', e.nativeEvent.description); if (!done.current) { done.current = true; onError(-3); } }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: 'transparent' },
});
