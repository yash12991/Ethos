import * as authApi from "./auth-api";

export type AliasResponse = {
  aliases: string[];
};

export async function fetchAliasSuggestions(): Promise<AliasResponse> {
  const aliases = await authApi.fetchAliasSuggestions();
  return { aliases };
}

export async function simulateSignup(): Promise<void> {
  // Keeping this as a mock for now unless requested otherwise
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

export async function simulateLogin(): Promise<void> {
  // Keeping this as a mock for now unless requested otherwise
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

export async function fetchRecoveryPhrase(): Promise<string> {
  return authApi.fetchRecoveryPhrase();
}
