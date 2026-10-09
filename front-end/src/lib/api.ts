import { getToken } from "@clerk/react";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

export class PaywallError extends Error {
  constructor() {
    super('trial_exhausted');
    this.name = 'PaywallError';
  }
}

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`API error ${status}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Clerk session tokens live ~60 s; getToken() returns a cached one and refreshes it in the
// background, so every request just asks for the current token.
async function sessionToken(skipCache = false): Promise<string> {
  const token = await getToken({ skipCache });
  if (!token) throw new Error("Not signed in");
  return token;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const makeRequest = (t: string) =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
        ...(options?.headers ?? {}),
      },
    });

  let res = await makeRequest(await sessionToken());

  // The cached token can expire in flight; retry once with a freshly minted one
  if (res.status === 401) {
    res = await makeRequest(await sessionToken(true));
  }

  if (res.status === 402) throw new PaywallError();
  if (!res.ok) throw new ApiError(res.status);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Presets ───────────────────────────────────────────────────────────────────

export interface Preset {
  id: string;
  user_id: string;
  name: string;
  business_name: string | null;
  ruc: string | null;
  timbrado: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  logo_data: string | null;
  created_at: string;
  updated_at: string;
}

export interface PresetData {
  name: string;
  business_name?: string;
  ruc?: string;
  timbrado?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  logo_data?: string;
}

export const fetchPresets = () =>
  apiFetch<Preset[]>("/presets");

export const createPreset = (data: PresetData) =>
  apiFetch<Preset>("/presets", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updatePreset = (id: string, data: Partial<PresetData>) =>
  apiFetch<Preset>(`/presets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deletePreset = (id: string) =>
  apiFetch<void>(`/presets/${id}`, { method: "DELETE" });

// ── Templates ─────────────────────────────────────────────────────────────────

export interface Template {
  id: string;
  user_id: string;
  preset_id: string | null;
  name: string;
  html_content: string;
  created_at: string;
  updated_at: string;
}

export const fetchTemplates = () =>
  apiFetch<Template[]>("/templates");

export const createTemplate = (
  data: { name: string; html_content: string; preset_id?: string },
) =>
  apiFetch<Template>("/templates", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateTemplate = (
  id: string,
  data: { name?: string; html_content?: string },
) =>
  apiFetch<Template>(`/templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteTemplate = (id: string) =>
  apiFetch<void>(`/templates/${id}`, { method: "DELETE" });

// ── Conversations ─────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  user_id: string;
  preset_id: string | null;
  title: string;
  template_html: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: ConversationMessage[];
}

export const fetchConversations = () =>
  apiFetch<Conversation[]>("/conversations");

export const fetchConversation = (id: string) =>
  apiFetch<ConversationWithMessages>(`/conversations/${id}`);

export const updateConversation = (id: string, data: { title: string }) =>
  apiFetch<Conversation>(`/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteConversation = (id: string) =>
  apiFetch<void>(`/conversations/${id}`, { method: "DELETE" });

// ── Users ─────────────────────────────────────────────────────────────────────

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

// Also provisions the local account on the first call after sign-up
export const fetchMe = () => apiFetch<{ user: AppUser }>('/me');

export const updateUserProfile = (data: { name: string }) =>
  apiFetch<{ name: string }>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteUserAccount = () =>
  apiFetch<void>('/users/me', { method: 'DELETE' });

// ── AI Chat ───────────────────────────────────────────────────────────────────

export interface ChatResponse {
  conversationId: string;
  message?: string;
  templateHtml?: string;
}

export const sendChat = (
  message: string,
  model: string,
  conversationId?: string,
  presetId?: string,
  templateHtml?: string,
) =>
  apiFetch<ChatResponse>("/ai/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      model,
      conversationId: conversationId ?? undefined,
      presetId: presetId ?? undefined,
      templateHtml: templateHtml ?? undefined,
    }),
  });
