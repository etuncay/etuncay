# RAG Chat Platform (AnythingLLM/LM Studio tarzı)

Modern, çok kiracılı (multi-tenant) RAG tabanlı sohbet arayüzü. Workspaces, threads, dosya yükleme ve basit TF‑IDF geri getirim içerir. LLM sağlayıcıları için yapılandırma alanı mevcuttur (şimdilik simülasyon yanıtı döner).

## Özellikler
- Workspaces oluşturma ve kredi yönetimi
- Çoklu ön talimat (prompt) desteği
- Threads ve mesaj geçmişi
- Dosya yükleme, basit metin çıkarımı, chunking ve TF‑IDF arama
- Tek sunucu: API + statik frontend

## Hızlı Başlangıç

```bash
cd /workspace
npm install
npm run dev
# Sunucu: http://localhost:8080
```

## Dizinler
- `apps/api` – Express API ve statik servis
- `apps/web` – Statik HTML/Tailwind arayüzü
- `storage/` – Yüklenen dosyalar ve çıkarılmış metinler
- `data/` – Veritabanı (`db.json`) ve indeksler

## Akış
1. Workspaces sayfasından bir workspace oluşturun (otomatik demo kullanıcı eklenir).
2. Upload sayfasında workspace id ile dosya(lar) yükleyin.
3. Sohbet sayfasında workspace seçin, mesaj gönderin. RAG, TF‑IDF ile en alakalı parçaları bağlam olarak ekler ve simüle bir yanıt döner.

## LLM Sağlayıcıları (taslak)
- OpenAI, Anthropic, Azure OpenAI, Ollama/LM Studio gibi sağlayıcılar için `/api/workspaces/:id/providers` ile kimlik bilgilerini kaydedin. Şimdilik yanıtlar simüle edilir; gerçek çağrılar kolayca eklenebilir.

## Notlar
- PDF/DOC vb. metin çıkarımı yer tutucudur. Üretimde `unstructured`, `pdf-parse`, `docx` vb. ekleyin.
- Bu iskelet; çoklu kiracı, paylaşımlı/publik veri seti, kredilendirme, faturalandırma (Stripe) gibi özellikler kolayca genişletilebilir. 


