# Pesan & Pengingat WhatsApp

Sarang dapat menyiapkan pesan WhatsApp untuk pelanggan Anda — pengingat janji temu, pemberitahuan pembayaran terlambat, perpanjangan keanggotaan/kontrak, dan banyak lagi, di setiap jenis bisnis — lalu menyerahkannya ke WhatsApp siap kirim. Sarang tidak pernah mengirim pesan secara otomatis: aplikasi ini selalu membuka WhatsApp Anda sendiri (Desktop atau Web) dengan pesan yang sudah terisi, dan Anda sendiri yang mengklik **Send**. Ini adalah pendekatan "Anda selalu memegang kendali" yang sama seperti yang digunakan tombol Share via WhatsApp pada Faktur dan dokumen lainnya (lihat **Penagihan & Dokumen**).

Ada tiga tempat terkait yang muncul di sini, dibahas di bawah: antrean **WhatsApp Reminders**, editor **Message Templates**, dan mengirim pesan ad-hoc dari halaman **Pelanggan** itu sendiri.

## WhatsApp Reminders — mengirim apa yang sudah disiapkan Sarang

Buka **WhatsApp Reminders** dari sidebar. Saat Anda menggunakan Sarang sehari-hari — memesan janji temu, faktur yang jatuh tempo, keanggotaan yang mendekati kedaluwarsa — aplikasi secara otomatis menyiapkan pesan pengingat dan menambahkannya di sini dengan status **Pending**. Belum ada yang terkirim; daftar ini hanyalah semua yang sudah siap dikirim.

Untuk setiap pengingat yang tertunda, Anda dapat:
- Klik **Send on WhatsApp** — membuka WhatsApp dengan pesan dan nomor telepon pelanggan yang sudah terisi. Anda meninjaunya lalu klik Send di dalam WhatsApp.
- Klik tanda centang untuk **Mark Sent** setelah Anda benar-benar mengirimnya, agar keluar dari daftar tertunda Anda.
- Klik X untuk **Dismiss** pengingat yang tidak ingin Anda kirim (misalnya Anda sudah menelepon pelanggan sebagai gantinya).

Gunakan filter **Pending / Sent / All** di bagian atas untuk meninjau riwayat. Pengingat hanya muncul di sini jika pelanggan memiliki nomor telepon yang tercatat — Sarang tidak dapat menyiapkan pesan WhatsApp tanpanya.

## Message Templates — menyesuaikan isi pengingat Anda

Setiap pesan pengingat di atas berasal dari sebuah template — satu untuk setiap situasi (pengingat janji temu, pembayaran terlambat, kedaluwarsa keanggotaan, dan seterusnya), mencakup setiap bidang bisnis yang didukung Sarang. Secara default ini menggunakan kata-kata yang sudah ditulis dengan baik, tetapi Anda dapat menyesuaikan salah satunya.

Buka **Settings → Message Templates**. Template dikelompokkan berdasarkan bidang bisnis (Gym, Hukum, Kedokteran Hewan, Logistik, dan seterusnya) — klik satu grup untuk memperluasnya. Untuk setiap template Anda akan melihat:

- Kata-katanya saat ini, dalam kotak teks yang dapat diedit.
- **Placeholder** yang didukungnya di bawah, ditampilkan sebagai `{{customerName}}`, `{{date}}`, dll. — ini akan diganti dengan detail asli pelanggan saat pengingat benar-benar dibuat. Pertahankan persis seperti yang ditampilkan (ejaan yang sama, kurung kurawal ganda yang sama) jika Anda mengedit teks di sekitarnya; placeholder yang dihapus atau salah ketik akan muncul secara harfiah dalam pesan terkirim, bukan nilai sebenarnya.
- Lencana **Customized** setelah Anda menyimpan kata-kata Anda sendiri, dan tombol **Reset to Default** untuk kembali ke kata-kata Sarang kapan saja.
- Lencana **Internal note** pada satu-satunya template (pengingat pembuatan faktur retainer) yang merupakan catatan tugas untuk staf Anda sendiri, tidak pernah dikirim ke pelanggan.

Klik **Preview** pada template mana pun untuk melihat seperti apa tampilannya sebenarnya, terisi dengan detail contoh yang realistis — cara cepat untuk memeriksa apakah kata-kata Anda terbaca alami sebelum menyimpan.

### Reminder Message Language

Di bagian atas layar Message Templates, seorang **admin/manajer** dapat mengatur **Reminder Message Language** — bahasa yang akan digunakan oleh template mana pun yang belum disesuaikan secara individual saat pengingat dibuat. Ini terpisah dari bahasa tampilan pribadi Anda sendiri (yang Anda pilih di Settings → Language): layar Anda sendiri bisa dalam bahasa Inggris sementara pengingat WhatsApp toko Anda keluar dalam bahasa Hindi, atau bahasa lain yang didukung, karena yang penting di sini adalah apa yang dipahami *pelanggan* Anda, bukan apa yang ditampilkan layar salah satu staf. Template yang Anda sesuaikan sendiri selalu menggunakan kata-kata tersimpan Anda sendiri, terlepas dari pengaturan ini.

## Mengirim pesan WhatsApp ad-hoc dari halaman Pelanggan

Tidak semua pesan cocok dengan pengingat terjadwal — terkadang Anda hanya ingin mengirim sesuatu ke pelanggan tertentu sekarang juga. Buka halaman pelanggan mana pun dan klik **Send WhatsApp Message** (hanya ditampilkan jika pelanggan tersebut memiliki nomor telepon yang tercatat).

1. Pilih template dari dropdown — katalog yang sama dengan Message Templates di atas, dibatasi pada yang ditujukan untuk pelanggan (catatan khusus internal tidak ditawarkan di sini).
2. Nama pelanggan sendiri terisi otomatis di mana pun template membutuhkannya. Isi apa pun yang dibutuhkan template lainnya (jumlah, tanggal, nomor kasus...) di kotak yang disediakan.
3. Pratinjau langsung diperbarui saat Anda mengetik, menampilkan persis apa yang akan dikirim.
4. Klik **WhatsApp** untuk membukanya dengan isian otomatis, sama seperti di tempat lain — tinjau dan kirim dari sana.

## Catatan tentang bagaimana WhatsApp sebenarnya terbuka

Membuka WhatsApp dengan cara ini akan meluncurkan WhatsApp Desktop jika terinstal, atau WhatsApp Web di browser Anda jika tidak — persis seperti tombol Share via WhatsApp pada Faktur dan dokumen lainnya. Sarang tidak memiliki cara untuk mengonfirmasi bahwa pesan benar-benar terkirim setelah WhatsApp terbuka — itulah sebabnya pengingat tetap dalam status **Pending** sampai Anda sendiri secara eksplisit mengklik **Mark Sent**.
