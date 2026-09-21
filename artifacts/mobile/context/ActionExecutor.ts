/**
 * ActionExecutor
 *
 * Reads the AI's JSON action plan and executes it step-by-step:
 *   1. Navigates to screens via expo-router
 *   2. Writes prefill data to AgentStateContext (screens auto-read it)
 *   3. Shows live status labels to the user
 *   4. Pauses at "confirm" steps for user approval
 *
 * Usage (inside AIAssistantContext):
 *   const executor = new ActionExecutor(router, agentState);
 *   executor.run(actionPlan, onStatusUpdate, onConfirmNeeded, onDone);
 */

import { router } from 'expo-router';
import type { AgentStep, AgentPrefill } from '@/context/AgentStateContext';

// Instant delays for lightning-fast sub-second navigation
const STEP_DELAY_MS = 0;
const NAV_DELAY_MS = 30;

type StatusCallback = (label: string, step: number, total: number) => void;
type ConfirmCallback = (message: string, onConfirm: () => void, onCancel: () => void) => void;
type DoneCallback = (success: boolean, message: string) => void;

interface AgentStateDispatch {
  setPrefill: (data: Partial<AgentPrefill>) => void;
  setPrefillKey: <K extends keyof AgentPrefill>(key: K, value: AgentPrefill[K]) => void;
  setStatus: (status: 'idle' | 'collecting' | 'ready' | 'executing' | 'waiting_confirm' | 'done' | 'cancelled') => void;
  setCurrentStepLabel: (label: string) => void;
  addCompletedStep: (label: string) => void;
  resetAgent: () => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Navigates to the correct route, handling:
 *  - /services routes (need params)
 *  - Tab routes
 *  - Regular stack routes
 */
function navigateTo(
  route: string,
  serviceView?: string,
  billKind?: string,
) {
  if (route === '/services' || serviceView) {
    const view = serviceView ?? 'travel';
    if (billKind) {
      router.navigate({
        pathname: '/services',
        params: { start: 'billPay', kind: billKind },
      } as any);
    } else {
      router.navigate({
        pathname: '/services',
        params: { start: view },
      } as any);
    }
    return;
  }

  // Handle dynamic routes with placeholder [id]
  if (route.includes('[id]')) {
    // The id should already be resolved before calling execute
    router.push(route as any);
    return;
  }

  router.push(route as any);
}

/**
 * Executes a parsed action plan step by step.
 *
 * @param steps - Array of AgentStep objects from the AI response
 * @param dispatch - AgentStateContext dispatch methods
 * @param onStatus - Called after each step with label + progress
 * @param onConfirmNeeded - Called when a confirm step is reached
 * @param onDone - Called when execution finishes
 * @param signal - AbortSignal to cancel mid-execution
 */
export async function executeActionPlan(
  steps: AgentStep[],
  dispatch: AgentStateDispatch,
  onStatus: StatusCallback,
  onConfirmNeeded: ConfirmCallback,
  onDone: DoneCallback,
  signal: AbortSignal,
): Promise<void> {
  dispatch.setStatus('executing');

  for (let i = 0; i < steps.length; i++) {
    if (signal.aborted) {
      dispatch.setStatus('cancelled');
      onDone(false, 'Agent cancelled.');
      return;
    }

    const step = steps[i];
    dispatch.setCurrentStepLabel(step.label);
    onStatus(step.label, i + 1, steps.length);

    await sleep(STEP_DELAY_MS);

    if (signal.aborted) {
      dispatch.setStatus('cancelled');
      onDone(false, 'Agent cancelled.');
      return;
    }

    switch (step.type) {
      case 'navigate': {
        dispatch.addCompletedStep(step.label);
        if (step.route) {
          navigateTo(step.route, step.serviceView, step.billKind);
          // Wait for screen to mount
          await sleep(NAV_DELAY_MS);
        }
        break;
      }

      case 'prefill': {
        dispatch.addCompletedStep(step.label);
        if (step.fields) {
          dispatch.setPrefill(step.fields);
        } else if (step.key !== undefined && step.value !== undefined) {
          dispatch.setPrefillKey(
            step.key as keyof AgentPrefill,
            step.value as any,
          );
        }
        // Instant execution so user sees the target screen immediately
        await sleep(30);
        break;
      }

      case 'confirm': {
        dispatch.setStatus('waiting_confirm');
        dispatch.addCompletedStep(step.label);

        // Pause and wait for user to confirm or cancel
        await new Promise<void>((resolve) => {
          onConfirmNeeded(
            step.message ?? 'Are you sure you want to proceed?',
            () => resolve(), // user confirmed
            () => {
              dispatch.setStatus('cancelled');
              onDone(false, 'Cancelled before payment.');
              resolve();
            },
          );
        });

        if (signal.aborted) {
          dispatch.setStatus('cancelled');
          onDone(false, 'Agent cancelled.');
          return;
        }

        dispatch.setStatus('executing');
        break;
      }

      case 'complete': {
        dispatch.addCompletedStep(step.label);
        dispatch.setStatus('done');
        onDone(true, step.message ?? 'Done! All steps completed.');
        return;
      }

      case 'message': {
        // Just show a label, no action
        dispatch.addCompletedStep(step.label);
        await sleep(500);
        break;
      }
    }
  }

  // If we reach here without a 'complete' step, mark done
  dispatch.setStatus('done');
  onDone(true, 'All steps completed successfully!');
}

/**
 * Parses the raw action plan from the AI response JSON.
 * Handles both well-formed and slightly malformed plans gracefully.
 */
export function parseActionPlan(raw: unknown): AgentStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      type: (item.type as AgentStep['type']) ?? 'message',
      label: (item.label as string) ?? '...',
      route: item.route as string | undefined,
      serviceView: item.serviceView as string | undefined,
      billKind: item.billKind as string | undefined,
      fields: item.fields as Partial<AgentPrefill> | undefined,
      key: item.key as string | undefined,
      value: item.value,
      message: item.message as string | undefined,
    }));
}

/**
 * Builds a simple navigation-only action plan for pure navigate intents
 * (wallet check, view bookings, etc.)
 */
export function buildNavigatePlan(
  route: string,
  screenName: string,
  serviceView?: string,
  billKind?: string,
): AgentStep[] {
  return [
    {
      type: 'navigate',
      route,
      serviceView,
      billKind,
      label: `Opening ${screenName}...`,
    },
    {
      type: 'complete',
      label: 'Done!',
      message: `I've opened ${screenName} for you!`,
    },
  ];
}
