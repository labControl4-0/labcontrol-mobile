import * as Notifications from "expo-notifications";
import type { Href } from "expo-router";

import { getAuthSession, type AuthSession } from "../lib/auth";
import {
  parseMachineEventPushPayload,
  routeForMachineEventPush,
  type MachineEventPushPayload,
} from "../lib/push/notificationPayload";

export type PushNavigationStatus =
  | "opened"
  | "invalid_payload"
  | "no_session"
  | "ignored_action";

export type PushNotificationsClient = Pick<
  typeof Notifications,
  | "DEFAULT_ACTION_IDENTIFIER"
  | "addNotificationReceivedListener"
  | "addNotificationResponseReceivedListener"
  | "getLastNotificationResponseAsync"
  | "clearLastNotificationResponseAsync"
>;

type PushRouter = { push: (href: Href) => void };

type PushNavigationOptions = {
  notifications?: PushNotificationsClient;
  readSession?: () => Promise<AuthSession | null>;
  onReceived?: (payload: MachineEventPushPayload | null) => void;
  onResponse?: (status: PushNavigationStatus) => void;
};

/** Valida o destino e exige uma sessão antes de navegar. */
export async function navigateFromNotificationData(
  data: unknown,
  router: PushRouter,
  readSession: () => Promise<AuthSession | null> = getAuthSession
): Promise<PushNavigationStatus> {
  const route = routeForMachineEventPush(data);
  if (!route) return "invalid_payload";

  const session = await readSession().catch(() => null);
  if (!session?.user.id) return "no_session";

  router.push(route);
  return "opened";
}

/**
 * Observa recebimentos em primeiro plano e cliques no app em segundo plano
 * ou encerrado. O último response cobre o início do app por toque na bandeja.
 */
export function startPushNavigation(
  router: PushRouter,
  options: PushNavigationOptions = {}
): () => void {
  const notifications = options.notifications ?? Notifications;
  const readSession = options.readSession ?? getAuthSession;
  const recentResponses = new Map<string, number>();
  let active = true;

  const clearLastResponse = () =>
    notifications.clearLastNotificationResponseAsync().catch(() => undefined);

  const processResponse = async (response: Notifications.NotificationResponse) => {
    if (!active) return;

    if (response.actionIdentifier !== notifications.DEFAULT_ACTION_IDENTIFIER) {
      await clearLastResponse();
      options.onResponse?.("ignored_action");
      return;
    }

    const responseKey =
      response.notification.request.identifier + ":" + response.actionIdentifier;
    const now = Date.now();

    for (const [key, handledAt] of recentResponses) {
      if (now - handledAt > 2000) recentResponses.delete(key);
    }
    const handledAt = recentResponses.get(responseKey);
    if (handledAt !== undefined && now - handledAt <= 2000) return;
    recentResponses.set(responseKey, now);

    const status = await navigateFromNotificationData(
      response.notification.request.content.data,
      router,
      readSession
    );
    if (active) options.onResponse?.(status);
    await clearLastResponse();
  };

  const receivedSubscription = notifications.addNotificationReceivedListener(
    (notification) => {
      const payload = parseMachineEventPushPayload(
        notification.request.content.data
      );
      options.onReceived?.(payload);
    }
  );

  const responseSubscription =
    notifications.addNotificationResponseReceivedListener((response) => {
      void processResponse(response);
    });

  notifications
    .getLastNotificationResponseAsync()
    .then((response) => {
      if (response) return processResponse(response);
      return undefined;
    })
    .catch(() => undefined);

  return () => {
    active = false;
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
