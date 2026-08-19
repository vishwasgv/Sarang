# Klinik Spesialis

Layar jenis bisnis ini hanya dalam bahasa Inggris, terlepas dari pengaturan bahasa Anda di tempat lain di Sarang.

## Fondasi layanan bersama

Setiap jenis bisnis berbasis layanan di Sarang — termasuk Klinik Spesialis — dimulai dari empat blok bangunan yang sama: **Janji Temu** (memesan dan menjadwalkan kunjungan), sebuah **Katalog Layanan** (daftar konsultasi dan prosedur yang ditawarkan praktik Anda), **Provider Schedules** (spesialis mana yang tersedia kapan), dan sebuah **Notification Queue** otomatis yang menangani pengingat tanpa Anda harus mengirimnya secara manual. Sisa bab ini membahas apa yang spesifik untuk praktik spesialis.

Sarang secara sengaja tidak memiliki jenis bisnis terpisah per spesialisasi medis (THT, mata, dermatologi, kardiologi, dan seterusnya). Sebaliknya, "Specialist Clinic" dibuat untuk mencakup **spesialisasi apa pun** melalui Service Catalog generik yang sama — Anda mendefinisikan jenis konsultasi dan prosedur Anda sendiri dengan harga Anda sendiri, dan catatan klinis di bawah beradaptasi untuk membawa field khusus-spesialis terlepas dari spesialisasi Anda.

## Consultation Notes dengan Referral Details

Membuka **Consultation Note** sebuah janji temu memberi Anda catatan SOAP terstruktur yang sama yang digunakan di seluruh jenis bisnis klinis Sarang (Patient Information, Subjective, Vitals dengan penandaan otomatis, Objective, Assessment, Plan, Follow-up) — lihat bab *Klinik Dokter Umum* untuk penjelasan lengkap field demi field — ditambah bagian **Referral Details** yang unik untuk Klinik Spesialis:

- **Referred By** dan **Referral Date** — mencatat siapa yang mengirim pasien ini kepada Anda (dokter luar atau klinik lain) dan kapan.
- **Referral Reason** — teks bebas.
- **Referring Doctor's Phone** dan **Referring Doctor's Email** — detail kontak opsional dokter yang merujuk. Inilah yang memungkinkan Anda menutup loop-nya: begitu catatan difinalisasi, sebuah tombol **Share** muncul di samping Print Summary yang mengirimkan ringkasan kunjungan (sebagai PDF) ke dokter yang merujuk lewat WhatsApp atau Email, agar mereka tahu bagaimana hasilnya untuk pasien yang mereka kirim. Tombol ini hanya muncul saat ada dokter perujuk yang tercatat pada catatan dan catatan sudah difinalisasi — catatan draf belum menjadi hasil sungguhan yang layak dikirim. Jika telepon atau email dibiarkan kosong, opsi berbagi terkait hanya akan tetap nonaktif, bukan gagal.

Ini terpisah dari **Refer to Another Provider**, sebuah aksi sungguhan di dalam aplikasi lebih bawah di layar yang sama: setelah catatan disimpan, Anda dapat memesan janji temu keluar sungguhan dengan penyedia lain di klinik Anda sendiri (pilih penyedia, tanggal, waktu, dan alasan opsional) — ini adalah janji temu yang benar-benar dipesan, bukan sekadar catatan. Setiap rujukan yang Anda kirim menampilkan statusnya sendiri (Scheduled / Completed / Cancelled / No-show) tepat di catatan kunjungan, dengan sebuah tombol **Print Referral Letter** yang menghasilkan surat formal yang ditujukan kepada penyedia yang dirujuk.

Sebuah kotak centang terpisah **"This is a second-opinion consultation"** di bagian yang sama menandai kunjungan di mana pasien sudah didiagnosis/diobati di tempat lain dan datang khusus untuk pendapat lain — berbeda dari rujukan, karena kunjungan opini kedua tidak memerlukan seseorang untuk mengirim mereka, dan pasien yang dirujuk belum tentu mencari opini kedua. Catatan yang dicentang menampilkan lencana **Second Opinion** di sebelah judul catatan, dan menjadi data untuk laporan Konversi Opini Kedua di bawah.

Dropdown **Case Complexity** tepat setelah bagian Assessment memungkinkan Anda menandai kunjungan sebagai **Routine** atau **Complex** — biarkan tidak diatur jika Anda tidak ingin mengklasifikasikan kunjungan tertentu; catatan yang tidak diatur hanya akan dikecualikan dari laporan Campuran Kompleksitas Kasus di bawah, bukan dihitung sebagai Rutin secara default.

Catatan tersebut juga membawa tabel **Prescription** berbutir yang sama dan grafik **Vitals Trend** yang dijelaskan di bab *Klinik Dokter Umum* — keduanya bekerja identik di sini.

## Token Queue

Klinik Spesialis juga mencakup layar **Antrean Token** untuk walk-in hari yang sama, persis seperti yang dijelaskan di bab *Klinik Dokter Umum* — menerbitkan token walk-in, memanggil pasien berikutnya, dan melacak jumlah Waiting / Called / Seen / Skipped. Antrean walk-in sama umumnya di praktik rawat jalan spesialis (kamp THT, kamp mata, klinik dermatologi) seperti halnya di praktik umum.

Satu tambahan di sini yang khusus untuk Klinik Spesialis: formulir **Add Walk-in** memiliki kotak centang **"Mark as urgent (referring doctor flagged this as urgent)"**. Token yang ditandai urgent menampilkan lencana merah **Urgent** dalam antrean dan dipanggil sebelum pasien yang check-in lebih dulu — **Call Next** selalu memilih token menunggu dengan prioritas tertinggi, pasien urgent dulu, lalu berdasarkan urutan check-in. Gunakan ini untuk walk-in yang dokter perujuknya menandai kasus tersebut perlu dilihat lebih cepat, bukan sebagai alat prioritas umum — sebagian besar walk-in sebaiknya tetap mengikuti urutan check-in biasa.

## Printing

**Print Summary** menghasilkan ringkasan kunjungan terformat termasuk bagian rujukan saat diisi, dengan disclaimer klinis yang sama yang digunakan di seluruh dokumen medis Sarang: ini adalah dokumen kenyamanan yang dihasilkan oleh Sarang, bukan catatan medis tervalidasi — selalu verifikasi sebelum penggunaan klinis.

## Reports

Buka **Reports → Referral Leaderboard** untuk melihat dokter perujuk mana yang mengirimkan pasien terbanyak kepada Anda dalam rentang tanggal — daftar berperingkat dengan jumlah, ditambah grafik batang sepuluh teratas. Ini adalah bidang "Referred By" nyata yang sama yang ditangkap pada Catatan Konsultasi, akhirnya diagregasi alih-alih tidak terpakai per catatan.

Buka **Reports → Second-Opinion Conversion** untuk melihat, dari kunjungan yang Anda tandai sebagai opini kedua dalam rentang tanggal, berapa banyak pasien tersebut kembali untuk janji temu selesai berikutnya dan menjadi pasien tetap — jumlah total, jumlah terkonversi, dan tingkat konversi, ditambah satu baris per pasien dengan tanggal kunjungan mereka dan (jika mereka kembali) tanggal kunjungan berikutnya. Hanya pasien yang tertaut ke catatan pelanggan asli yang dapat dilacak dengan cara ini; pelanggan walk-in tanpa catatan pelanggan tidak dihitung di kedua sisi.

Buka **Reports → Case-Complexity Mix** untuk melihat pembagian antara kasus Rutin dan Kompleks dalam rentang tanggal — grafik batang bertumpuk bulan demi bulan, ditambah total kasus yang ditandai, jumlah Rutin dan Kompleks, serta persentase Kompleks keseluruhan. Hanya kunjungan yang Anda atur dropdown Case Complexity-nya yang dihitung; kunjungan yang tidak ditandai tidak dianggap Rutin, melainkan hanya dikeluarkan dari campuran.

Jika Anda menggunakan **Refer to Another Provider** untuk mengirim pasien dalam klinik Anda sendiri, setelah penyedia tersebut menyelesaikan catatannya sendiri pada janji temu rujukan, hasilnya muncul kembali secara otomatis pada catatan asli Anda — tanpa perlu pencarian terpisah untuk mengetahui apa yang terjadi pada pasien yang Anda rujuk.
