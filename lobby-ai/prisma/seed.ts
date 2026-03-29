import { PrismaClient, Role, Department } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seed verisi oluşturuluyor...')

  // Admin kullanıcısı
  const adminPassword = await bcrypt.hash('admin123456', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@lobby-pr.com' },
    update: {},
    create: {
      email: 'admin@lobby-pr.com',
      name: 'Admin Kullanıcı',
      password: adminPassword,
      role: Role.ADMIN,
      department: Department.MEDYA_ILISKILERI,
    },
  })

  // Demo kullanıcıları
  const userPassword = await bcrypt.hash('demo123456', 12)

  await prisma.user.upsert({
    where: { email: 'medya@lobby-pr.com' },
    update: {},
    create: {
      email: 'medya@lobby-pr.com',
      name: 'Ayşe Kaya',
      password: userPassword,
      role: Role.USER,
      department: Department.MEDYA_ILISKILERI,
    },
  })

  await prisma.user.upsert({
    where: { email: 'musteri@lobby-pr.com' },
    update: {},
    create: {
      email: 'musteri@lobby-pr.com',
      name: 'Mehmet Demir',
      password: userPassword,
      role: Role.COORDINATOR,
      department: Department.MUSTERI_ILISKILERI,
    },
  })

  await prisma.user.upsert({
    where: { email: 'etkinlik@lobby-pr.com' },
    update: {},
    create: {
      email: 'etkinlik@lobby-pr.com',
      name: 'Zeynep Şahin',
      password: userPassword,
      role: Role.USER,
      department: Department.ETKINLIK,
    },
  })

  await prisma.user.upsert({
    where: { email: 'raporlama@lobby-pr.com' },
    update: {},
    create: {
      email: 'raporlama@lobby-pr.com',
      name: 'Can Yıldız',
      password: userPassword,
      role: Role.USER,
      department: Department.RAPORLAMA,
    },
  })

  // Örnek müşteriler
  const tupras = await prisma.client.upsert({
    where: { id: 'client-tupras' },
    update: {},
    create: {
      id: 'client-tupras',
      name: 'TÜPRAŞ',
      sector: 'Enerji & Petrokimya',
      description: "Türkiye'nin en büyük sanayi kuruluşu ve tek petrol rafinericisi.",
      tone: 'Kurumsal, güven veren, teknik uzmanlığı ön plana çıkaran',
      terminology: 'sürdürülebilirlik, enerji dönüşümü, yeşil dönüşüm, verimlilik, teknolojik yenilik',
      avoidTerms: 'en büyük (kanıtlanmamışsa), tek (kanıtlanmamışsa), rakiplerden söz etme',
      brandGuidelines: "TÜPRAŞ marka adı büyük harflerle yazılmalı. Türkiye'nin enerji güvenliğine katkı her zaman vurgulanmalı.",
    },
  })

  await prisma.client.upsert({
    where: { id: 'client-sigorta' },
    update: {},
    create: {
      id: 'client-sigorta',
      name: 'Anadolu Sigorta',
      sector: 'Finans & Sigortacılık',
      description: "Türkiye'nin köklü sigorta şirketlerinden biri.",
      tone: 'Güven verici, sıcak, erişilebilir, müşteri odaklı',
      terminology: 'güvence, koruma, huzur, geleceğe yatırım, sigorta çözümleri',
      avoidTerms: 'prim artışı, hasar reddi, zorunlu',
      brandGuidelines: 'Müşteri odaklı ve empatik dil kullanılmalı. Teknik jargondan kaçınılmalı.',
    },
  })

  await prisma.client.upsert({
    where: { id: 'client-teknoloji' },
    update: {},
    create: {
      id: 'client-teknoloji',
      name: 'Getir',
      sector: 'Teknoloji & E-Ticaret',
      description: 'Türkiye kökenli global hızlı teslimat platformu.',
      tone: 'Dinamik, yenilikçi, samimi, enerjik, genç',
      terminology: 'hız, kolaylık, anında, sürdürülebilir teslimat, teknoloji',
      avoidTerms: 'gecikmeli, sorunlu, yavaş',
      brandGuidelines: "Getir markası küçük 'g' ile yazılır. Turuncu marka rengi metinlerde belirtilmez.",
    },
  })

  // Medya İlişkileri Şablonları
  await prisma.template.upsert({
    where: { id: 'tmpl-basin-bulteni' },
    update: {},
    create: {
      id: 'tmpl-basin-bulteni',
      name: 'Basın Bülteni',
      department: Department.MEDYA_ILISKILERI,
      category: 'bülten',
      outputFormat: 'docx',
      variables: ['müşteri_adı', 'konu', 'tarih', 'ek_bilgi'],
      promptBody: `Sen, Lobby İletişim ajansında çalışan deneyimli bir kurumsal iletişim uzmanısın.

MÜŞTERİ BİLGİLERİ:
- Şirket: {{müşteri_adı}}
- Sektör: {{müşteri_sektör}}
- Kurumsal ton: {{müşteri_ton}}
- Kullanılacak terminoloji: {{müşteri_terminoloji}}
- Kaçınılacak ifadeler: {{müşteri_kaçınılacak}}

GÖREV:
{{konu}} hakkında bir basın bülteni yaz. Tarih: {{tarih}}
{{ek_bilgi}}

FORMAT:
- Başlık (dikkat çekici, 10 kelimeyi geçmesin)
- Alt başlık (1 cümle)
- Giriş paragrafı (5N1K — kim, ne, nerede, ne zaman, neden, nasıl)
- Gelişme (2-3 paragraf, detaylar ve alıntılar)
- Şirket hakkında kısa bilgi (boilerplate, 2-3 cümle)
- İletişim bilgileri bölümü
- Toplam 300-500 kelime

KURALLAR:
- {{müşteri_ton}} tonunda yaz
- Kanıtlanmamış üstünlük sıfatları kullanma
- Rakip şirketlerden bahsetme
- Türkçe dil kurallarına titizlikle uy`,
    },
  })

  await prisma.template.upsert({
    where: { id: 'tmpl-medya-raporu' },
    update: {},
    create: {
      id: 'tmpl-medya-raporu',
      name: 'Medya Raporu',
      department: Department.MEDYA_ILISKILERI,
      category: 'rapor',
      outputFormat: 'docx',
      variables: ['müşteri_adı', 'dönem', 'haber_sayısı', 'yayın_listesi'],
      promptBody: `Sen, Lobby İletişim ajansında çalışan medya analiz uzmanısın.

{{dönem}} dönemi için {{müşteri_adı}} müşterimizin medya raporunu hazırla.

Medyaya yansıma verileri:
- Toplam haber sayısı: {{haber_sayısı}}
- Yayınlar: {{yayın_listesi}}

FORMAT:
- Yönetici Özeti
- Medya Yansıma Özeti
- Öne Çıkan Haberler
- Yayın Dağılımı Analizi
- Tonlama Analizi (olumlu/nötr/olumsuz)
- Genel Değerlendirme ve Öneriler`,
    },
  })

  await prisma.template.upsert({
    where: { id: 'tmpl-kriz-iletisim' },
    update: {},
    create: {
      id: 'tmpl-kriz-iletisim',
      name: 'Kriz İletişim Taslağı',
      department: Department.MEDYA_ILISKILERI,
      category: 'kriz',
      outputFormat: 'docx',
      variables: ['müşteri_adı', 'kriz_konusu', 'durum_özeti'],
      promptBody: `Sen, Lobby İletişim ajansında çalışan kriz iletişim uzmanısın.

{{müşteri_adı}} için kriz iletişim taslağı hazırla.
Kriz konusu: {{kriz_konusu}}
Durum özeti: {{durum_özeti}}

FORMAT:
- İlk Açıklama (medyaya)
- Çalışan İletişim Mesajı
- Sosyal Medya Paylaşımı
- SSS (Sıkça Sorulan Sorular) — 5 soru-cevap
- Yapılacaklar Listesi

KURALLAR:
- Sakin, kontrollu ve şeffaf dil kullan
- Sorumluluğu kabul et ama aşırı özür dileme
- Çözüm odaklı ol`,
    },
  })

  // Müşteri İlişkileri Şablonları
  await prisma.template.upsert({
    where: { id: 'tmpl-musteri-teklif' },
    update: {},
    create: {
      id: 'tmpl-musteri-teklif',
      name: 'Müşteri Teklif Dokümanı',
      department: Department.MUSTERI_ILISKILERI,
      category: 'teklif',
      outputFormat: 'docx',
      variables: ['müşteri_adı', 'hizmet_türü', 'bütçe_aralığı', 'süre'],
      promptBody: `Sen, Lobby İletişim ajansında çalışan iş geliştirme uzmanısın.

{{müşteri_adı}} için {{hizmet_türü}} hizmetine yönelik teklif dokümanı hazırla.
Bütçe aralığı: {{bütçe_aralığı}}
Süre: {{süre}}

FORMAT:
- Yönetici Özeti
- Lobby İletişim Hakkında
- Müşteri İhtiyaç Analizi
- Önerilen Hizmet Kapsamı
- Çalışma Metodolojisi
- Ekip ve Deneyim
- Referanslar
- Fiyatlandırma ve Ödeme Planı
- Sonraki Adımlar`,
    },
  })

  await prisma.template.upsert({
    where: { id: 'tmpl-musteri-raporu' },
    update: {},
    create: {
      id: 'tmpl-musteri-raporu',
      name: 'Müşteri Faaliyet Raporu',
      department: Department.MUSTERI_ILISKILERI,
      category: 'rapor',
      outputFormat: 'docx',
      variables: ['müşteri_adı', 'dönem', 'tamamlanan_işler', 'hedefler'],
      promptBody: `Sen, Lobby İletişim ajansında çalışan müşteri ilişkileri uzmanısın.

{{müşteri_adı}} için {{dönem}} dönemi faaliyet raporu hazırla.

Tamamlanan işler: {{tamamlanan_işler}}
Dönem hedefleri: {{hedefler}}

FORMAT:
- Dönem Özeti
- Tamamlanan Faaliyetler
- Hedef Gerçekleşme Analizi
- Medya Yansımaları Özeti
- Bir Sonraki Dönem Planı
- Genel Değerlendirme`,
    },
  })

  // Etkinlik Şablonları
  await prisma.template.upsert({
    where: { id: 'tmpl-etkinlik-sunum' },
    update: {},
    create: {
      id: 'tmpl-etkinlik-sunum',
      name: 'Etkinlik Sunum Taslağı',
      department: Department.ETKINLIK,
      category: 'sunum',
      outputFormat: 'pptx',
      variables: ['etkinlik_adı', 'müşteri_adı', 'tarih', 'yer', 'katılımcı_sayısı'],
      promptBody: `Sen, Lobby İletişim - Event Factory departmanında çalışan etkinlik uzmanısın.

{{etkinlik_adı}} etkinliği için sunum taslağı hazırla.
Müşteri: {{müşteri_adı}}
Tarih: {{tarih}}
Yer: {{yer}}
Beklenen katılımcı: {{katılımcı_sayısı}}

FORMAT (Sunum Slaytları):
1. Kapak Sayfası
2. Etkinlik Konsepti
3. Program Akışı
4. Mekan ve Lojistik
5. Teknik Altyapı
6. Catering ve Organizasyon
7. İletişim Planı
8. Bütçe Özeti
9. Ekip ve Sorumluluklar
10. Sonraki Adımlar`,
    },
  })

  await prisma.template.upsert({
    where: { id: 'tmpl-davetiye' },
    update: {},
    create: {
      id: 'tmpl-davetiye',
      name: 'Davetiye Metni',
      department: Department.ETKINLIK,
      category: 'davetiye',
      outputFormat: 'docx',
      variables: ['etkinlik_adı', 'müşteri_adı', 'tarih', 'saat', 'yer', 'davetli_profili'],
      promptBody: `Sen, Lobby İletişim - Event Factory departmanında çalışan etkinlik iletişim uzmanısın.

{{etkinlik_adı}} etkinliği için davetiye metni yaz.
Düzenleyen: {{müşteri_adı}}
Tarih: {{tarih}} — Saat: {{saat}}
Yer: {{yer}}
Davetli profili: {{davetli_profili}}

KURALLAR:
- Resmi ve davet edici dil kullan
- Etkinliğin önemini ve değerini vurgula
- Katılım için net yönlendirme yap
- 150-250 kelime arasında olsun
- Hem e-posta hem basılı versiyona uygun format`,
    },
  })

  // Raporlama Şablonları
  await prisma.template.upsert({
    where: { id: 'tmpl-aylik-rapor' },
    update: {},
    create: {
      id: 'tmpl-aylik-rapor',
      name: 'Aylık PR Performans Raporu',
      department: Department.RAPORLAMA,
      category: 'rapor',
      outputFormat: 'docx',
      variables: ['ay', 'yıl', 'toplam_haber', 'medya_değeri', 'öne_çıkan_haberler'],
      promptBody: `Sen, Lobby İletişim ajansında çalışan raporlama uzmanısın.

{{ay}} {{yıl}} ayı için aylık PR performans raporu hazırla.

Veriler:
- Toplam haber sayısı: {{toplam_haber}}
- Tahmini medya değeri: {{medya_değeri}}
- Öne çıkan haberler: {{öne_çıkan_haberler}}

FORMAT:
- Yönetici Özeti
- Aylık Performans Göstergeleri
- Medya Yansıma Analizi
- Öne Çıkan Başarılar
- Gelişim Alanları
- Gelecek Ay Planlaması
- Veri Tabloları`,
    },
  })

  console.log('✅ Seed verisi başarıyla oluşturuldu!')
  console.log('\n📋 Test hesapları:')
  console.log('Admin: admin@lobby-pr.com / admin123456')
  console.log('Medya: medya@lobby-pr.com / demo123456')
  console.log('Müşteri: musteri@lobby-pr.com / demo123456')
  console.log('Etkinlik: etkinlik@lobby-pr.com / demo123456')
  console.log('Raporlama: raporlama@lobby-pr.com / demo123456')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
