export function bangladeshMobile(value: string): string | null {
  let digits = value.replace(/[০-৯]/g, d => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/[^0-9]/g, "");
  if (/^01[3-9]\d{8}$/.test(digits)) digits = `88${digits}`;
  return /^8801[3-9]\d{8}$/.test(digits) ? `+${digits}` : null;
}

export function smsSegments(message: string): number {
  if (!message) return 0;
  const basic = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
  const extended = "\f^{}\\[~]|€";
  let units = 0;
  for (const char of message) {
    if (basic.includes(char)) units++;
    else if (extended.includes(char)) units += 2;
    else return message.length <= 70 ? 1 : Math.ceil(message.length / 67);
  }
  return units <= 160 ? 1 : Math.ceil(units / 153);
}
