/** Web (and Jest): no push notifications. Native builds use push-token.native.ts. */
export async function devicePushToken(
  _projectId: string,
): Promise<{ token: string; platform: 'ios' | 'android' } | null> {
  return null;
}
