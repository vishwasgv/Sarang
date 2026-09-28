# Panduan: Pengingat dan Peringatan

Sarang memberi tahu Anda dua hal berbeda, di dua tempat berbeda. Mengetahui mana yang mana menghilangkan sebagian besar kebingungan.

| | **Peringatan** (lonceng) | **Pengingat WhatsApp** |
|---|---|---|
| Untuk siapa | **Anda** | **Pelanggan, pemasok, atau pasien Anda** |
| Di mana | Ikon lonceng di bilah atas | **Reminders & Messages → WhatsApp Reminders** |
| Contoh | Stok rendah, cadangan selesai, pengingat jatuh tempo, pemeriksaan basis data | "Janji temu Anda besok jam 10:00", "Pembayaran Anda telat", "Keanggotaan Anda berakhir dalam 7 hari" |
| Yang Anda lakukan | Klik: Sarang membuka layar yang bersangkutan | Klik **Send on WhatsApp**, lalu tekan Kirim di WhatsApp |
| Terkirim otomatis? | Ditampilkan otomatis | **Tidak pernah.** Sarang menyiapkan pesannya; Anda selalu yang menekan Kirim |

## Peringatan (lonceng)

Lonceng menampilkan angka saat ada yang perlu perhatian Anda. Buka dan klik sebuah peringatan:

- **WhatsApp Reminders Due** membuka layar WhatsApp Reminders.
- **Low Stock Alert** membuka Inventory.
- **Auto-Backup Complete** dan **Database Integrity Issue** membuka Backup.
- **Compliance Tasks Generated** (kantor CA dan CS) membuka Compliance.

Peringatan yang ditandai **Open →** dapat diklik. Mengkliknya juga menandainya sudah dibaca. **Mark all read** menghapus angkanya.

## Pengingat WhatsApp

Sarang menyiapkan pengingat dari apa yang terjadi di usaha Anda dan mendaftarkannya di **WhatsApp Reminders**, dalam tiga tab: **Pending**, **Sent**, dan **All**.

Untuk setiap pengingat yang tertunda Anda melihat untuk siapa, pesannya, dan kapan jatuh temponya.

1. Klik **Send on WhatsApp**. WhatsApp (aplikasi desktop atau WhatsApp Web) terbuka dengan nomor orang itu dan pesan yang sudah terketik.
2. Tekan **Send** di WhatsApp. Langkah ini selalu milik Anda.
3. Kembali ke Sarang, klik tanda centang (**Mark as sent**) agar berpindah ke *Sent*. Gunakan tanda silang (**Dismiss**) untuk yang Anda putuskan tidak dikirim.

Pengingat **tanpa nomor telepon** menampilkan "No phone number, so this can't be sent". Tambahkan nomornya ke pelanggan atau pemasok, atau abaikan. Hanya pengingat yang benar-benar dapat dikirim yang dapat ditandai terkirim. Pengingat yang nomor teleponnya terlalu pendek untuk nyata ditandai **Failed** dan tidak dihitung siap kirim: perbaiki nomornya pada pelanggan dan pengingat berikutnya akan berfungsi.

**Pelanggan yang meminta untuk tidak dihubungi.** Centang **Do not send this customer messages** pada formulir pelanggan. Pengingat mereka yang tertunda dihapus, tidak lagi tampil siap kirim, dan tombol sekali pakai **Send WhatsApp Message** menolaknya.

### Apa yang membuat pengingat

- **Janji Temu** (klinik, salon, gym, dan usaha berbasis janji temu lainnya): sebuah pengingat **24 jam sebelumnya** dan satu lagi **2 jam sebelumnya** waktu janji temu. Dihitung dari tanggal dan waktu janji temu, jadi janji temu besok jam 10:00 diingatkan hari ini jam 10:00 dan besok jam 08:00. Pemesanan yang dibuat kurang dari 24 jam sebelumnya hanya mendapat pengingat 2 jam; yang dibuat kurang dari 2 jam sebelumnya tidak mendapat pengingat sama sekali.
- **Menjadwal ulang atau membatalkan** janji temu mengganti atau menghapus pengingat tertundanya, sehingga tidak ada yang diingatkan tentang waktu lama. Janji temu yang selesai, tidak hadir, dan sedang berlangsung juga kehilangan pengingat tertundanya.
- **Tidak ada telepon pada pelanggan**: tidak ada pengingat yang dibuat, dan Sarang memberi tahu Anda saat memesan.
- **Pembayaran telat** (7, 14, dan 30 hari), **perpanjangan keanggotaan dan kontrak**, **tanggal vaksin dan kontrol ulang**, **iuran tertunggak**, **tanggal sidang hukum**, **pengiriman yang dikirim atau tertunda**, **barang diterima** (ucapan terima kasih ke pemasok, hanya jika pemasok punya nomor telepon), dan banyak lagi yang spesifik untuk usaha Anda.
- **Halaman pelanggan → Send WhatsApp Message**: pesan sekali pakai yang Anda tulis sendiri.

### Mengirim banyak sekaligus

Pengingat jatuh tempo sepanjang hari. Sarang memeriksa setiap jam selagi terbuka dan menaruh peringatan **WhatsApp Reminders Due** di lonceng. Jika Sarang tertutup, pengingat menunggu; tidak hilang, ditampilkan sebagai jatuh tempo saat Anda berikutnya membukanya.

### Templat Pesan

**Reminders & Messages → Message Templates** memungkinkan Anda mengubah kata-kata setiap pengingat, melihat pratinjau langsung, dan memilih **bahasa pengingat**.

- Pertahankan placeholder seperti `{{name}}` dan `{{date}}` persis seperti tertulis; Sarang mengisinya. Jika Anda mengetik placeholder yang tidak dapat diisi pesan itu (salah ketik seperti `{{nmae}}`) atau kurung kurawal yang tidak berpasangan, Sarang memperingatkan Anda saat mengetik dan tidak akan menyimpannya.
- **Kata-kata disimpan untuk bahasa pengingat yang Anda pilih.** Pilih Hindi di atas dan tulis kata-kata Hindi Anda; pilih Inggris dan tulis kata-kata Inggris Anda. Kata-kata yang disimpan saat Inggris dipilih juga berlaku untuk bahasa mana pun yang belum Anda tulis sendiri. **Reset** menghapus kata-kata yang berlaku saat ini dan mengembalikan teks bawaan.
- **Pengingat yang sudah tertunda diperbarui** saat Anda menyimpan templat, mengubah bahasa pengingat, atau mengganti tanda tangan: Sarang menulis ulang agar sesuai, dan memberi tahu berapa banyak yang diperbarui. Pengingat yang Anda edit manual, atau yang tidak lagi sesuai dengan templatnya, dibiarkan apa adanya.
- **Tanda tangan.** Pesan bawaan diakhiri dengan "Powered by Sarang | www.aszurex.com". Hilangkan centang **End messages with Powered by Sarang** di bagian atas layar untuk menghapusnya dari semua pesan.
- Setiap pengingat dimulai dengan nama usaha Anda dalam huruf tebal, ditambahkan otomatis.

## Peringatan yang Anda tetapkan sendiri

**Settings → Business Features → Alert rules** mengirimi Anda notifikasi lonceng saat penjualan, tagihan pemasok, atau pengeluaran sebesar setidaknya jumlah yang Anda pilih disimpan (misalnya "Invoice saved, at least 50,000"). Anda dapat mematikan atau menghapus aturan. Aturan hanya memberi tahu Anda; tidak pernah menghentikan atau mengubah dokumen, dan berlaku untuk dokumen yang dibuat di layar utama.

## Kebiasaan baik

- Periksa **WhatsApp Reminders** sekali di pagi hari dan sekali di sore hari.
- Jaga nomor telepon tetap konsisten dalam format internasional atau lokal; Sarang menambahkan kode negara Anda ke nomor lokal (Sarang mengetahui kode telepon sekitar 100 negara). Jika negara Anda tidak dikenali, ketik nomor dengan kode negara dan tanda plus.
- Tanyakan pada Sarang: "Berapa banyak pengingat yang tertunda?" memberi tahu Anda berapa yang siap, berapa yang dijadwalkan untuk nanti, dan berapa yang gagal.
