import "server-only";

export function schoolSmsConfig(schoolId: string) {
  const apiKey = process.env.TEXTBEE_API_KEY?.trim();
  const deviceId = process.env.TEXTBEE_DEVICE_ID?.trim();
  if (process.env.TEXTBEE_SCHOOL_ID !== schoolId || !apiKey || !deviceId || !/^[a-f0-9]{24}$/i.test(deviceId)) return null;
  return { apiKey, deviceId };
}
