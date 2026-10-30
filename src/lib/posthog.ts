import posthog from 'posthog-js';

const key = import.meta.env.VITE_POSTHOG_KEY?.trim();
const host = import.meta.env.VITE_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';

let started = false;

export function initPosthog() {
  if (!key || started || typeof window === 'undefined') return;
  started = true;
  posthog.init(key, {
    api_host: host,
    defaults: '2026-08-30',
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    // Session replay stays off. The privacy notice covers product events only.
    disable_session_recording: true,
  });
}

export function identifySistrumUser(userId: string | null) {
  if (!started) return;
  if (userId) posthog.identify(userId);
  else posthog.reset();
}

export function captureSistrum(event: string, properties?: Record<string, string>) {
  if (!started) return;
  posthog.capture(event, properties);
}

export function captureSistrumException(error: unknown) {
  if (!started) return;
  posthog.captureException(error);
}
