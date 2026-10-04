# Smart GitHub APK Builder

واجهة عربية مناسبة للهاتف لتجهيز مشاريع Android/Flutter/Capacitor وبنائها عبر GitHub Actions باستخدام Fine-grained Personal Access Token.

## GitHub token

للاستخدام مع المستودعات الموجودة، امنح Fine-grained token وصولًا إلى المستودع المطلوب وفعّل على الأقل:

- Repository permissions → Actions: Read and write
- Repository permissions → Contents: Read and write
- Repository permissions → Workflows: Write
- Repository permissions → Metadata: Read-only

ولإنشاء مستودع جديد من الموقع، يحتاج الـ token إلى صلاحية إنشاء المستودعات/Administration المناسبة بحسب حساب GitHub.

الموقع لا يضع المفتاح في ملفات المشروع أو في GitHub workflow.

## تشغيل محلي

npm install
npm run dev

للنشر على Vercel، ارفع المشروع أو اربطه بمستودع GitHub.
