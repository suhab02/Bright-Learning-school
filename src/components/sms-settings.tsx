import { schoolSmsConfig } from "@/lib/sms-config";
import { Card } from "@/components/ui";

export function SmsSettings({schoolId,locale}:{schoolId:string;locale:"en"|"bn"}) {
  const L=(en:string,bn:string)=>locale==='bn'?bn:en;
  const configured=Boolean(schoolSmsConfig(schoolId));
  return <Card className="space-y-3 p-4">
    <h2 className="font-semibold">{L("Guardian SMS setup", "অভিভাবক SMS সেটআপ")}</h2>
    <p className="text-sm text-ink-2">{configured?L("TextBee settings are configured. A real send and device delivery have not been verified by this screen.","TextBee সেটিংস প্রস্তুত। এই পৃষ্ঠায় SMS পাঠানো বা ডেলিভারি যাচাই করা হয়নি।"):L("TextBee is not connected yet.","TextBee এখনো সংযুক্ত নয়।")}</p>
    <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
      <li>{L("Create a TextBee account and register an Android phone with the school's Bangladesh SIM.","TextBee অ্যাকাউন্ট তৈরি করে স্কুলের বাংলাদেশি সিমসহ Android ফোন নিবন্ধন করুন।")}</li>
      <li>{L("Keep that phone online with SMS permission enabled. Use the SIM's SMS pack or pay its normal SMS charges.","ফোনে SMS-এর অনুমতি দিয়ে অনলাইনে রাখুন। সিমের SMS প্যাক বা সাধারণ SMS চার্জ প্রযোজ্য।")}</li>
      <li>{L("In Vercel → Project Settings → Environment Variables, add the three settings below for Production, then redeploy. Keep the API key secret.","Vercel → Project Settings → Environment Variables-এ Production-এর জন্য নিচের তিনটি সেটিংস যোগ করে redeploy করুন। API key গোপন রাখুন।")}</li>
    </ol>
    <div className="space-y-2 rounded-xl bg-surface-2 p-3 text-xs">
      <p><code>TEXTBEE_API_KEY</code> — {L("your private TextBee API key (Secret)","আপনার গোপন TextBee API key (Secret)")}</p>
      <p><code>TEXTBEE_DEVICE_ID</code> — {L("the registered Android device ID", "নিবন্ধিত Android ফোনের device ID")}</p>
      <p className="break-all"><code>TEXTBEE_SCHOOL_ID</code> — <span className="select-all">{schoolId}</span></p>
    </div>
    <p className="text-xs leading-relaxed text-ink-2">{L("Free TextBee plan: 50 messages/day and 300/month. SIM charges still apply. This connection sends only when you press Send via school SIM; event-based automatic alerts are not enabled.","TextBee ফ্রি প্ল্যান: দিনে ৫০টি ও মাসে ৩০০টি বার্তা। সিমের চার্জ প্রযোজ্য। ‘স্কুলের সিম থেকে SMS পাঠান’ চাপলেই পাঠানো হবে; ঘটনার ভিত্তিতে স্বয়ংক্রিয় বার্তা চালু নয়।")}</p>
    <a className="inline-flex min-h-11 items-center font-semibold text-brand" href="https://textbee.dev/" target="_blank" rel="noreferrer">{L("Open TextBee", "TextBee খুলুন")}</a>
  </Card>;
}
