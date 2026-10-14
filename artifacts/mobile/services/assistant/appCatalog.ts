/**
 * Apps the assistant can open by name, and the code that works out which one a user meant.
 *
 * Neither Android nor iOS lets an app launch another one by its display name, so each app has to be known by
 * its package. System apps (camera, settings, dialer...) are the exception: their package differs on every
 * brand (Pixel, Samsung, Xiaomi...), so those are opened by what they do (an intent), which works everywhere.
 *
 * Pure code (no React Native): see scripts/appCommand.selfcheck.ts.
 */

import { coarseKey, plain, rankNames } from './nameMatch';

export interface AppEntry {
  label: string;
  /** Names people say, in Latin letters. Other scripts are matched by sound (see nameMatch.ts). */
  names: string[];
  pkg?: string;
  /** How to open a system app on any phone. */
  intent?: { action: string; category?: string };
  /**
   * False when the same word is also a WishMe screen ("settings", "messages", "calendar"), so a voice
   * shortcut must not guess: the assistant decides from context.
   */
  quick?: boolean;
}

const MAIN = 'android.intent.action.MAIN';

export const APPS: AppEntry[] = [
  // ── System apps: opened by intent, whatever the brand ─────────────────────
  { label: 'Camera', names: ['camera', 'cam'], intent: { action: 'android.media.action.STILL_IMAGE_CAMERA' } },
  { label: 'Settings', names: ['settings', 'phone settings', 'android settings'], intent: { action: 'android.settings.SETTINGS' }, quick: false },
  { label: 'Phone', names: ['phone', 'dialer', 'dial pad', 'dialpad', 'phone app'], intent: { action: 'android.intent.action.DIAL' } },
  { label: 'Contacts', names: ['contacts', 'contact list', 'phonebook', 'phone book'], intent: { action: MAIN, category: 'android.intent.category.APP_CONTACTS' } },
  { label: 'Messages', names: ['messages', 'sms', 'text messages', 'messaging'], intent: { action: MAIN, category: 'android.intent.category.APP_MESSAGING' }, quick: false },
  { label: 'Gallery', names: ['gallery', 'photo gallery'], intent: { action: MAIN, category: 'android.intent.category.APP_GALLERY' } },
  { label: 'Calculator', names: ['calculator', 'calc'], intent: { action: MAIN, category: 'android.intent.category.APP_CALCULATOR' } },
  { label: 'Calendar', names: ['phone calendar'], intent: { action: MAIN, category: 'android.intent.category.APP_CALENDAR' }, quick: false },
  { label: 'Clock', names: ['clock', 'alarm', 'alarms', 'alarm clock'], intent: { action: 'android.intent.action.SHOW_ALARMS' } },
  { label: 'Email', names: ['email', 'mail', 'e mail'], intent: { action: MAIN, category: 'android.intent.category.APP_EMAIL' } },
  { label: 'Browser', names: ['browser', 'web browser', 'internet'], intent: { action: MAIN, category: 'android.intent.category.APP_BROWSER' } },
  { label: 'Music player', names: ['music player', 'music app'], intent: { action: MAIN, category: 'android.intent.category.APP_MUSIC' }, quick: false },

  // ── Google ────────────────────────────────────────────────────────────────
  { label: 'Chrome', names: ['chrome', 'google chrome'], pkg: 'com.android.chrome' },
  { label: 'Gmail', names: ['gmail', 'google mail'], pkg: 'com.google.android.gm' },
  { label: 'Google Maps', names: ['maps', 'google maps', 'map'], pkg: 'com.google.android.apps.maps' },
  { label: 'Google Photos', names: ['photos', 'google photos'], pkg: 'com.google.android.apps.photos' },
  { label: 'Google Drive', names: ['drive', 'google drive'], pkg: 'com.google.android.apps.docs' },
  { label: 'Google Docs', names: ['docs', 'google docs'], pkg: 'com.google.android.apps.docs.editors.docs' },
  { label: 'Google Sheets', names: ['sheets', 'google sheets'], pkg: 'com.google.android.apps.docs.editors.sheets' },
  { label: 'Google Slides', names: ['slides', 'google slides'], pkg: 'com.google.android.apps.docs.editors.slides' },
  { label: 'Google Keep', names: ['keep', 'google keep', 'keep notes'], pkg: 'com.google.android.keep' },
  { label: 'Google', names: ['google', 'google search', 'google app'], pkg: 'com.google.android.googlequicksearchbox' },
  { label: 'Google Translate', names: ['translate', 'google translate'], pkg: 'com.google.android.apps.translate' },
  { label: 'Google Meet', names: ['meet', 'google meet'], pkg: 'com.google.android.apps.tachyon' },
  { label: 'Gemini', names: ['gemini', 'google gemini'], pkg: 'com.google.android.apps.bard' },
  { label: 'Google Pay', names: ['google pay', 'gpay', 'g pay', 'tez'], pkg: 'com.google.android.apps.nbu.paisa.user' },
  { label: 'Play Store', names: ['play store', 'google play', 'playstore', 'google play store'], pkg: 'com.android.vending' },
  { label: 'YouTube', names: ['youtube', 'you tube', 'yt'], pkg: 'com.google.android.youtube' },
  { label: 'YouTube Music', names: ['youtube music', 'yt music'], pkg: 'com.google.android.apps.youtube.music' },

  // ── Messaging and social ──────────────────────────────────────────────────
  { label: 'WhatsApp', names: ['whatsapp', 'whats app', 'watsapp', 'whatsup'], pkg: 'com.whatsapp' },
  { label: 'WhatsApp Business', names: ['whatsapp business', 'whatsapp biz', 'whats app business'], pkg: 'com.whatsapp.w4b' },
  { label: 'Instagram', names: ['instagram', 'insta', 'ig'], pkg: 'com.instagram.android' },
  { label: 'Instagram Lite', names: ['instagram lite', 'insta lite'], pkg: 'com.instagram.lite' },
  { label: 'Facebook', names: ['facebook', 'fb', 'face book'], pkg: 'com.facebook.katana' },
  { label: 'Facebook Lite', names: ['facebook lite', 'fb lite'], pkg: 'com.facebook.lite' },
  { label: 'Messenger', names: ['messenger', 'facebook messenger', 'fb messenger'], pkg: 'com.facebook.orca' },
  { label: 'Telegram', names: ['telegram'], pkg: 'org.telegram.messenger' },
  { label: 'Signal', names: ['signal'], pkg: 'org.thoughtcrime.securesms' },
  { label: 'Snapchat', names: ['snapchat', 'snap'], pkg: 'com.snapchat.android' },
  { label: 'X', names: ['x', 'twitter', 'x twitter'], pkg: 'com.twitter.android' },
  { label: 'Threads', names: ['threads'], pkg: 'com.instagram.barcelona' },
  { label: 'LinkedIn', names: ['linkedin', 'linked in'], pkg: 'com.linkedin.android' },
  { label: 'Pinterest', names: ['pinterest'], pkg: 'com.pinterest' },
  { label: 'Reddit', names: ['reddit'], pkg: 'com.reddit.frontpage' },
  { label: 'Discord', names: ['discord'], pkg: 'com.discord' },
  { label: 'Skype', names: ['skype'], pkg: 'com.skype.raider' },
  { label: 'Zoom', names: ['zoom'], pkg: 'us.zoom.videomeetings' },
  { label: 'Microsoft Teams', names: ['teams', 'microsoft teams'], pkg: 'com.microsoft.teams' },
  { label: 'ShareChat', names: ['sharechat', 'share chat'], pkg: 'in.mohalla.sharechat' },
  { label: 'Moj', names: ['moj'], pkg: 'in.mohalla.video' },
  { label: 'Truecaller', names: ['truecaller', 'true caller'], pkg: 'com.truecaller' },

  // ── Money and UPI ─────────────────────────────────────────────────────────
  { label: 'Paytm', names: ['paytm', 'pay tm'], pkg: 'net.one97.paytm' },
  { label: 'PhonePe', names: ['phonepe', 'phone pe', 'phone pay'], pkg: 'com.phonepe.app' },
  { label: 'BHIM', names: ['bhim', 'bhim upi'], pkg: 'in.org.npci.upiapp' },
  { label: 'CRED', names: ['cred'], pkg: 'com.dreamplug.androidapp' },
  { label: 'Groww', names: ['groww', 'grow'], pkg: 'com.nextbillion.groww' },
  { label: 'Zerodha Kite', names: ['kite', 'zerodha', 'zerodha kite'], pkg: 'com.zerodha.kite3' },
  { label: 'YONO SBI', names: ['yono', 'yono sbi', 'sbi', 'sbi yono'], pkg: 'com.sbi.SBIFreedomPlus' },
  { label: 'HDFC Bank', names: ['hdfc', 'hdfc bank'], pkg: 'com.snapwork.hdfc' },
  { label: 'iMobile Pay', names: ['icici', 'imobile', 'icici bank', 'imobile pay'], pkg: 'com.csam.icici.bank.imobile' },
  { label: 'Axis Mobile', names: ['axis', 'axis bank', 'axis mobile'], pkg: 'com.axis.mobile' },
  { label: 'Kotak', names: ['kotak', 'kotak bank', 'kotak mahindra'], pkg: 'com.msf.kbank.mobile' },

  // ── Shopping and food ─────────────────────────────────────────────────────
  { label: 'Amazon', names: ['amazon', 'amazon shopping'], pkg: 'in.amazon.mShop.android.shopping' },
  { label: 'Flipkart', names: ['flipkart', 'flip kart'], pkg: 'com.flipkart.android' },
  { label: 'Myntra', names: ['myntra'], pkg: 'com.myntra.android' },
  { label: 'Meesho', names: ['meesho'], pkg: 'com.meesho.supply' },
  { label: 'Ajio', names: ['ajio'], pkg: 'com.ril.ajio' },
  { label: 'Nykaa', names: ['nykaa'], pkg: 'com.fsn.nykaa' },
  { label: 'JioMart', names: ['jiomart', 'jio mart'], pkg: 'com.jpl.jiomart' },
  { label: 'BigBasket', names: ['bigbasket', 'big basket'], pkg: 'com.bigbasket.mobileapp' },
  { label: 'Swiggy', names: ['swiggy', 'instamart', 'swiggy instamart'], pkg: 'in.swiggy.android' },
  { label: 'Zomato', names: ['zomato'], pkg: 'com.application.zomato' },
  { label: 'Blinkit', names: ['blinkit', 'blink it', 'grofers'], pkg: 'com.grofers.customerapp' },
  { label: 'Zepto', names: ['zepto'], pkg: 'com.zeptoconsumerapp' },

  // ── Travel and rides ──────────────────────────────────────────────────────
  { label: 'Uber', names: ['uber'], pkg: 'com.ubercab' },
  { label: 'Ola', names: ['ola', 'ola cabs'], pkg: 'com.olacabs.customer' },
  { label: 'Rapido', names: ['rapido'], pkg: 'com.rapido.passenger' },
  { label: 'Namma Yatri', names: ['namma yatri', 'nammayatri'], pkg: 'in.juspay.nammayatri' },
  { label: 'redBus', names: ['redbus', 'red bus'], pkg: 'in.redbus.android' },
  { label: 'IRCTC Rail Connect', names: ['irctc', 'rail connect', 'irctc rail connect'], pkg: 'cris.org.in.prs.ima' },
  { label: 'MakeMyTrip', names: ['makemytrip', 'make my trip', 'mmt'], pkg: 'com.makemytrip' },
  { label: 'Goibibo', names: ['goibibo'], pkg: 'com.goibibo' },
  { label: 'Cleartrip', names: ['cleartrip', 'clear trip'], pkg: 'com.cleartrip.android' },
  { label: 'ixigo', names: ['ixigo'], pkg: 'com.ixigo.train.ixitrain' },
  { label: 'Booking.com', names: ['booking com'], pkg: 'com.booking', quick: false },
  { label: 'OYO', names: ['oyo'], pkg: 'com.oyo.consumer' },
  { label: 'Airbnb', names: ['airbnb'], pkg: 'com.airbnb.android' },

  // ── Video, music and reading ──────────────────────────────────────────────
  { label: 'Netflix', names: ['netflix'], pkg: 'com.netflix.mediaclient' },
  { label: 'JioHotstar', names: ['hotstar', 'jiohotstar', 'jio hotstar', 'disney hotstar'], pkg: 'in.startv.hotstar' },
  { label: 'Prime Video', names: ['prime video', 'amazon prime', 'amazon prime video', 'prime'], pkg: 'com.amazon.avod.thirdpartyclient' },
  { label: 'SonyLIV', names: ['sonyliv', 'sony liv'], pkg: 'com.sonyliv' },
  { label: 'ZEE5', names: ['zee5', 'zee 5'], pkg: 'com.graymatrix.did' },
  { label: 'JioCinema', names: ['jiocinema', 'jio cinema'], pkg: 'com.jio.media.ondemand' },
  { label: 'MX Player', names: ['mx player', 'mxplayer'], pkg: 'com.mxtech.videoplayer.ad' },
  { label: 'VLC', names: ['vlc'], pkg: 'org.videolan.vlc' },
  { label: 'Spotify', names: ['spotify'], pkg: 'com.spotify.music' },
  { label: 'Gaana', names: ['gaana'], pkg: 'com.gaana' },
  { label: 'JioSaavn', names: ['jiosaavn', 'saavn', 'jio saavn'], pkg: 'com.jio.media.jiobeats' },
  { label: 'Wynk Music', names: ['wynk', 'wynk music'], pkg: 'com.bsbportal.music' },
  { label: 'Shazam', names: ['shazam'], pkg: 'com.shazam.android' },
  { label: 'Kindle', names: ['kindle'], pkg: 'com.amazon.kindle' },

  // ── Phone, utilities and government ───────────────────────────────────────
  { label: 'MyJio', names: ['myjio', 'my jio', 'jio'], pkg: 'com.jio.myjio' },
  { label: 'Airtel Thanks', names: ['airtel', 'airtel thanks'], pkg: 'com.myairtelapp' },
  { label: 'DigiLocker', names: ['digilocker', 'digi locker'], pkg: 'com.digilocker.android' },
  { label: 'UMANG', names: ['umang'], pkg: 'in.gov.umang.negd.g2c' },
  { label: 'mAadhaar', names: ['maadhaar', 'aadhaar', 'aadhar'], pkg: 'in.gov.uidai.mAadhaarPlus' },
  { label: 'Microsoft Word', names: ['word', 'microsoft word'], pkg: 'com.microsoft.office.word' },
  { label: 'Microsoft Excel', names: ['excel', 'microsoft excel'], pkg: 'com.microsoft.office.excel' },
  { label: 'PowerPoint', names: ['powerpoint', 'power point', 'microsoft powerpoint'], pkg: 'com.microsoft.office.powerpoint' },
  { label: 'Outlook', names: ['outlook'], pkg: 'com.microsoft.office.outlook' },
  { label: 'OneDrive', names: ['onedrive', 'one drive'], pkg: 'com.microsoft.skydrive' },
  { label: 'Dropbox', names: ['dropbox'], pkg: 'com.dropbox.android' },
  { label: 'Firefox', names: ['firefox'], pkg: 'org.mozilla.firefox' },
  { label: 'Brave', names: ['brave'], pkg: 'com.brave.browser' },
  { label: 'Canva', names: ['canva'], pkg: 'com.canva.editor' },
  { label: 'Duolingo', names: ['duolingo'], pkg: 'com.duolingo' },
  { label: 'Quora', names: ['quora'], pkg: 'com.quora.android' },
  { label: 'Expo Go', names: ['expo', 'expo go', 'expo app', 'expo client', 'expo dev'], pkg: 'host.exp.exponent' },
  { label: 'Tinder', names: ['tinder'], pkg: 'com.tinder' },

  // ── Games ─────────────────────────────────────────────────────────────────
  { label: 'BGMI', names: ['bgmi', 'pubg', 'battlegrounds'], pkg: 'com.pubg.imobile' },
  { label: 'Free Fire', names: ['free fire', 'freefire'], pkg: 'com.dts.freefireth' },
  { label: 'Ludo King', names: ['ludo king', 'ludo'], pkg: 'com.ludo.king' },
  { label: 'Candy Crush', names: ['candy crush'], pkg: 'com.king.candycrushsaga' },
  { label: 'Subway Surfers', names: ['subway surfers'], pkg: 'com.kiloo.subwaysurf' },
];

/** More popular apps, as "Label|other names (comma separated)|package". Parsed below into catalogue entries. */
const MORE_APPS = `
ChatGPT|chat gpt,chat jipiti,gpt,openai,open ai|com.openai.chatgpt
Claude|claude ai|com.anthropic.claude
Perplexity|perplexity ai|ai.perplexity.app.android
Copilot|microsoft copilot,co pilot|com.microsoft.copilot
DeepSeek|deep seek|com.deepseek.chat
Grok||ai.x.grok
Meta AI||com.facebook.stella
Character AI||ai.character.app
NotebookLM|notebook lm|com.google.android.apps.labs.language.tailwind
Microsoft 365|office|com.microsoft.office.officehubrow
Google Calendar||com.google.android.calendar
Google Contacts||com.google.android.contacts
Phone by Google|google phone|com.google.android.dialer
Google Messages||com.google.android.apps.messaging
Google Clock||com.google.android.deskclock
Google Calculator||com.google.android.calculator
Files by Google|files go,google files|com.google.android.apps.nbu.files
Google Home||com.google.android.apps.chromecast.app
Google Fit||com.google.android.apps.fitness
Google Lens|lens|com.google.ar.lens
Google News||com.google.android.apps.magazines
Google Tasks||com.google.android.apps.tasks
Google One||com.google.android.apps.subscriptions.red
Google Wallet||com.google.android.apps.walletnfcrel
Google TV||com.google.android.videos
Classroom|google classroom|com.google.android.apps.classroom
Google Authenticator|authenticator|com.google.android.apps.authenticator2
Google Chat||com.google.android.apps.dynamite
Google Earth||com.google.earth
YouTube Kids||com.google.android.apps.youtube.kids
YouTube Studio||com.google.android.apps.youtube.creator
Find My Device||com.google.android.apps.adm
Snapseed||com.niksoftware.snapseed
Google Assistant||com.google.android.apps.googleassistant
Edge|microsoft edge|com.microsoft.emmx
OneNote|one note|com.microsoft.office.onenote
Microsoft Authenticator||com.azure.authenticator
Microsoft To Do||com.microsoft.todos
Bing||com.microsoft.bing
Slack||com.Slack
Notion||notion.id
Trello||com.trello
Webex||com.cisco.webex.meetings
Zoho Mail||com.zoho.mail
Viber||com.viber.voip
LINE||jp.naver.line.android
WeChat|we chat|com.tencent.mm
Tumblr||com.tumblr
Bumble||com.bumble.app
Josh||com.eterno.shortvideos
Roposo||com.roposo.android
Chingari||io.chingari.app
Dailyhunt|daily hunt|com.eterno
Inshorts||com.nis.app
Pratilipi||com.pratilipi.mobile.android
Times of India|toi|com.toi.reader.activities
NDTV||com.july.ndtv
Aaj Tak||in.AajTak.headlines
Paytm Money||com.paytmmoney
MobiKwik|mobikwik|com.mobikwik_new
Navi||com.naviapp
Jupiter||money.jupiter
Fi|fi money|com.epifi.paisa
slice||indwin.c3.shareapp
Upstox||in.upstox.pro
Angel One|angel broking|com.msf.angelmobile
ET Money|et money|com.smartspends
INDmoney|ind money|in.indwealth
Dhan||com.dhan.live
Bajaj Finserv||org.altruist.BajajExperia
PayZapp|pay zapp|com.enstage.wibmo.hdfc
YONO Lite||com.sbi.lotusintouch
BHIM SBI Pay||com.sbi.upi
bob World|bank of baroda|com.bankofbaroda.mconnect
Canara ai1|canara bank|com.canarabank.mobility
Union Bank Vyom|union bank|com.infrasoft.uboi
IDFC FIRST|idfc|com.idfcfirstbank.optimus
FedMobile|federal bank|com.fedmobile
Dunzo||com.dunzo.user
Tata Neu|tata new|com.tatadigital.tcp
Snapdeal||com.snapdeal.main
Shopsy||com.flipkart.shopsy
Lenskart||com.lenskart.app
Purplle||com.manash.purplle
FirstCry|first cry|fc.admin.fcexpressadmin
PharmEasy|pharm easy|com.phonegap.rxpal
Tata 1mg|1mg|com.aranoah.healthkart.plus
Apollo 247|apollo|com.apollo.patientapp
Practo||com.practo.fabric
Licious||com.licious
Domino's|dominos,domino|com.Dominos
EatSure|eat sure|com.done.faasos
magicpin|magic pin|com.magicpin.local
Urban Company|urban clap|com.urbanclap.urbanclap
NoBroker|no broker|com.nobroker.app
99acres|ninety nine acres|com.nnacres.app
MagicBricks|magic bricks|com.timesgroup.magicbricks
BookMyShow|book my show,bms|com.bt.bms
Yatra||com.yatra.base
EaseMyTrip|ease my trip|com.easemytrip.android
AbhiBus|abhi bus|com.abhibus.mobile
Where is my Train|where is my train|com.whereismytrain.android
ConfirmTkt|confirm ticket|com.confirmtkt.lite
IndiGo|indigo|in.goindigo.android
inDrive|in drive|sinet.startup.inDriver
Mappls|mapmyindia,map my india|com.mmi.maps
mParivahan|m parivahan|com.nic.mparivahan
Amazon Music||com.amazon.mp3
Apple Music||com.apple.android.music
Pocket FM|pocket fm|com.radio.pocketfm
Kuku FM|kuku fm|com.vlv.aravali
Audible||com.audible.application
SoundCloud|sound cloud|com.soundcloud.android
Hungama||com.hungama.myplay.activity
Sun NXT|sun next|com.suntv.sunnxt
Hoichoi||com.viewlift.hoichoi
Airtel Xstream|xstream|tv.accedo.airtel.wynk
Tata Play|tata sky|com.ryzmedia.tatasky
Twitch||tv.twitch.android.app
Cricbuzz|cric buzz|com.cricbuzz.android
ESPNcricinfo|cricinfo|com.july.cricinfo
FanCode|fan code|com.dream11sportsguru
Dream11|dream 11|com.app.dream11Pro
JioTV|jio tv|com.jio.jioplay.tv
JioMeet|jio meet|com.jio.rilconferences
JioCloud|jio cloud|com.rjil.cloud.tej
BYJU'S|byjus,byju|com.byjus.thelearningapp
Unacademy|un academy|com.unacademyapp
Physics Wallah|pw,physics wala|xyz.penpencil.physicswala
Coursera||org.coursera.android
Udemy||com.udemy.android
Khan Academy||org.khanacademy.android
Doubtnut|doubt nut|com.doubtnutapp
Photomath|photo math|com.microblink.photomath
Brainly||co.brainly
Testbook|test book|com.testbook.tbapp
Adda247|adda 247|com.adda247.app
DIKSHA|diksha|in.gov.diksha.app
Naukri||naukriApp.appModules.login
Indeed||com.indeed.android.jobsearch
apna||com.apnatime
Internshala||com.internshala.app
Aarogya Setu|aarogya setu|nic.goi.aarogyasetu
mPassport Seva|passport seva|gov.mea.psp
Sanchar Saathi||com.dot.app.sancharsaathi
ABHA||in.ndhm.phr
Voter Helpline|voter app|com.eci.citizen
Vi|vodafone,idea,vi app|com.mventus.selfcare.activity
CamScanner|cam scanner|com.intsig.camscanner
Adobe Scan||com.adobe.scan.android
Adobe Acrobat|pdf reader,acrobat|com.adobe.reader
WPS Office|wps|cn.wps.moffice_eng
Lightroom||com.adobe.lrmobile
PicsArt|pics art|com.picsart.studio
CapCut|cap cut|com.lemon.lvoverseas
InShot|in shot|com.camerasideas.instashot
VN Video Editor|vn editor|com.frontrow.vlog
KineMaster|kine master|com.nexstreaming.app.kinemasterfree
Remini||com.bigwinepot.nwdn.international
SHAREit|share it|com.lenovo.anyshare.gps
Opera||com.opera.browser
Opera Mini||com.opera.mini.native
Samsung Internet||com.sec.android.app.sbrowser
DuckDuckGo|duck duck go|com.duckduckgo.mobile.android
Speedtest|speed test|org.zwanoo.android.speedtest
HealthifyMe|healthify me|com.healthifyme.basic
Flo||org.iggymedia.periodtracker
Strava||com.strava
Samsung Health||com.sec.android.app.shealth
Samsung Notes||com.samsung.android.app.notes
Galaxy Store||com.sec.android.app.samsungapps
My Files|samsung files|com.sec.android.app.myfiles
Voice Recorder|recorder|com.sec.android.app.voicenote
Clash of Clans|coc|com.supercell.clashofclans
Clash Royale||com.supercell.clashroyale
Call of Duty|cod,call of duty mobile|com.activision.callofduty.shooter
Minecraft||com.mojang.minecraftpe
Roblox||com.roblox.client
Among Us||com.innersloth.spacemafia
Pokemon GO|pokemon go|com.nianticlabs.pokemongo
Free Fire MAX|free fire max|com.dts.freefiremax
8 Ball Pool|eight ball pool|com.miniclip.eightballpool
Carrom Pool||com.miniclip.carrom
Temple Run 2|temple run|com.imangi.templerun2
Chess.com|chess|com.chess
Hill Climb Racing||com.fingersoft.hillclimb
Genshin Impact||com.miHoYo.GenshinImpact
Samsung Calculator||com.sec.android.app.popupcalculator
Samsung Clock||com.sec.android.app.clockpackage
`;

function parseMore(): AppEntry[] {
  const out: AppEntry[] = [];
  for (const line of MORE_APPS.split('\n')) {
    const [label, names, pkg] = line.split('|');
    if (!label || !pkg) continue;
    out.push({ label, names: [label.toLowerCase(), ...(names ? names.split(',').map((n) => n.trim()).filter(Boolean) : [])], pkg });
  }
  return out;
}

/** System pages of the phone's Settings, opened by intent. */
const SETTINGS_PAGES: [string, string[], string][] = [
  ['Wi-Fi settings', ['wifi settings', 'wifi', 'wi fi'], 'android.settings.WIFI_SETTINGS'],
  ['Bluetooth settings', ['bluetooth settings', 'bluetooth'], 'android.settings.BLUETOOTH_SETTINGS'],
  ['Display settings', ['display settings', 'display', 'brightness'], 'android.settings.DISPLAY_SETTINGS'],
  ['Sound settings', ['sound settings', 'sound', 'volume settings'], 'android.settings.SOUND_SETTINGS'],
  ['Location settings', ['location settings', 'location', 'gps'], 'android.settings.LOCATION_SOURCE_SETTINGS'],
  ['Battery', ['battery settings', 'battery usage'], 'android.intent.action.POWER_USAGE_SUMMARY'],
  ['Mobile data settings', ['mobile data', 'data usage'], 'android.settings.DATA_USAGE_SETTINGS'],
  ['Storage settings', ['storage settings', 'storage'], 'android.settings.INTERNAL_STORAGE_SETTINGS'],
  ['App settings', ['apps settings', 'manage apps'], 'android.settings.APPLICATION_SETTINGS'],
  ['Date and time settings', ['date settings', 'time settings', 'date and time'], 'android.settings.DATE_SETTINGS'],
  ['Language settings', ['language settings', 'languages'], 'android.settings.LOCALE_SETTINGS'],
  ['Security settings', ['security settings'], 'android.settings.SECURITY_SETTINGS'],
  ['Accessibility settings', ['accessibility settings', 'accessibility'], 'android.settings.ACCESSIBILITY_SETTINGS'],
  ['Airplane mode settings', ['airplane mode', 'flight mode'], 'android.settings.AIRPLANE_MODE_SETTINGS'],
  ['NFC settings', ['nfc settings', 'nfc'], 'android.settings.NFC_SETTINGS'],
  ['About phone', ['about phone', 'device info'], 'android.settings.DEVICE_INFO_SETTINGS'],
];

APPS.push(
  ...parseMore().filter((m) => !APPS.some((a) => a.pkg === m.pkg)),
  { label: 'Files', names: ['files', 'file manager', 'file explorer', 'downloads'], intent: { action: MAIN, category: 'android.intent.category.APP_FILES' } },
  ...SETTINGS_PAGES.map(([label, names, action]): AppEntry => ({ label, names, intent: { action }, quick: false })),
);

/**
 * Extra ways to start an app when asking Android for its launcher intent is not allowed (Android 11+ hides other apps
 * from this one unless the manifest says it may look; see plugins/withLauncherQueries.js). An explicit activity name or a
 * deep-link scheme starts the app without having to look it up first. A wrong activity name just fails at once and the
 * next way is tried.
 */
export interface LaunchHint {
  activity?: string;
  scheme?: string;
  /** Other package names the same app ships under. */
  alts?: string[];
}

export const LAUNCH_HINTS: Record<string, LaunchHint> = {
  'com.whatsapp': { activity: 'com.whatsapp.Main', scheme: 'whatsapp://' },
  'com.whatsapp.w4b': { activity: 'com.whatsapp.Main' },
  'com.google.android.youtube': { activity: 'com.google.android.youtube.app.honeycomb.Shell$HomeActivity', scheme: 'vnd.youtube://' },
  'com.android.chrome': { activity: 'com.google.android.apps.chrome.Main' },
  'com.google.android.gm': { activity: 'com.google.android.gm.ConversationListActivityGmail' },
  'com.google.android.apps.maps': { activity: 'com.google.android.maps.MapsActivity', scheme: 'geo:0,0' },
  'com.android.vending': { activity: 'com.android.vending.AssetBrowserActivity', scheme: 'market://' },
  'com.instagram.android': { activity: 'com.instagram.mainactivity.LauncherActivity', scheme: 'instagram://app' },
  'org.telegram.messenger': { activity: 'org.telegram.ui.LaunchActivity', scheme: 'tg://', alts: ['org.telegram.messenger.web'] },
  'com.spotify.music': { activity: 'com.spotify.music.MainActivity', scheme: 'spotify:' },
  'com.facebook.katana': { activity: 'com.facebook.katana.LoginActivity', scheme: 'fb://' },
  'host.exp.exponent': { activity: 'host.exp.exponent.LauncherActivity', scheme: 'exp://' },
  'com.twitter.android': { scheme: 'twitter://' },
  'com.snapchat.android': { scheme: 'snapchat://' },
  'com.linkedin.android': { scheme: 'linkedin://' },
  'com.reddit.frontpage': { scheme: 'reddit://' },
  'com.discord': { scheme: 'discord://' },
  'com.netflix.mediaclient': { scheme: 'nflx://' },
  'net.one97.paytm': { scheme: 'paytmmp://' },
  'com.phonepe.app': { scheme: 'phonepe://' },
  'com.google.android.apps.nbu.paisa.user': { scheme: 'tez://' },
  'com.application.zomato': { scheme: 'zomato://' },
  'in.swiggy.android': { scheme: 'swiggy://' },
  'in.amazon.mShop.android.shopping': { scheme: 'amazon://' },
  'com.flipkart.android': { scheme: 'flipkart://' },
  'com.ubercab': { scheme: 'uber://' },
  'com.olacabs.customer': { scheme: 'olacabs://' },
  'com.openai.chatgpt': { activity: 'com.openai.chatgpt.MainActivity' },
  'us.zoom.videomeetings': { activity: 'com.zipow.videobox.LauncherActivity', scheme: 'zoomus://' },
  'com.microsoft.teams': { scheme: 'msteams://' },
  'com.Slack': { scheme: 'slack://open' },
  'com.skype.raider': { scheme: 'skype:' },
  'com.viber.voip': { scheme: 'viber://' },
  'com.facebook.orca': { scheme: 'fb-messenger://' },
  'com.pinterest': { scheme: 'pinterest://' },
  'com.truecaller': { activity: 'com.truecaller.ui.TruecallerInit' },
  'com.google.android.apps.youtube.music': { activity: 'com.google.android.apps.youtube.music.activities.MusicActivity' },
  'com.google.android.apps.photos': { activity: 'com.google.android.apps.photos.home.HomeActivity' },
  'com.google.android.calculator': { activity: 'com.android.calculator2.Calculator' },
  'com.google.android.deskclock': { activity: 'com.android.deskclock.DeskClock' },
  'com.google.android.calendar': { activity: 'com.android.calendar.AllInOneActivity' },
  'com.google.android.contacts': { activity: 'com.android.contacts.activities.PeopleActivity' },
  'com.google.android.apps.messaging': { activity: 'com.google.android.apps.messaging.ui.ConversationListActivity' },
  'com.sec.android.app.popupcalculator': { activity: 'com.sec.android.app.popupcalculator.Calculator' },
  'com.sec.android.app.clockpackage': { activity: 'com.sec.android.app.clockpackage.ClockPackage' },
};

/** Words that only say "this is an app": "open the WhatsApp app please". */
const APP_FILLER = new Set(['app', 'apps', 'application', 'the', 'my', 'please', 'pls', 'kindly']);

/** "app" written in an Indic script (ऐप, एप, ಆಪ್, ஆப், ఆప్ ...): a short non-Latin word that sounds like just "p". */
const isAppWord = (w: string) =>
  APP_FILLER.has(w) || (/[^a-z0-9]/.test(w) && w.length <= 6 && coarseKey(w) === 'p');

/** The app name without the filler around it. */
export function cleanAppPhrase(spoken: string): string {
  // "open ChatGPT in my mobile": where it is does not name the app.
  const where = plain(spoken).replace(/\b(in|on|from)\s+(my|the|this)?\s*(mobile|phone|device|cellphone)\b/g, ' ');
  const words = where.split(' ').filter(Boolean);
  const kept = words.filter((w) => !isAppWord(w));
  return (kept.length ? kept : words).join(' ');
}

/**
 * The app the user meant, or null when none of the known apps sounds like it. `minScore` 70 only accepts a
 * name that is (nearly) spelled or pronounced the same; the assistant's own tool call uses a looser 55 because
 * the model has already decided the user wants an app.
 */
export function resolveApp(spoken: string, minScore = 70): AppEntry | null {
  const phrase = cleanAppPhrase(spoken);
  if (!phrase) return null;
  // Strict: an app name must match as a whole word or sound the same. "expo" is not "MX Player" because they share a letter.
  return rankNames(phrase, APPS, (app) => [app.label, ...app.names], minScore, { strict: true })[0]?.item ?? null;
}
