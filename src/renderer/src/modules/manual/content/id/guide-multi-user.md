# Panduan: Memakai Sarang di Lebih dari Satu PC

Sebagian toko membutuhkan dua atau tiga orang bekerja bersamaan: satu di kasir, satu mengurus pembelian, satu memeriksa akun. Sarang bisa melakukannya di jaringan toko Anda sendiri. Tidak ada yang lewat internet.

## Cara kerjanya

- Satu PC menyimpan semua data. Itu disebut **server**. Biarkan tetap menyala dengan Sarang terbuka selama jam toko.
- PC lainnya adalah **klien**. Mereka tidak menyimpan data usaha. Mereka menampilkan dan mengubah data yang disimpan di server.
- Semua yang dikirim antar PC dienkripsi dengan **rahasia bersama** yang Anda pilih. Fitur ini nonaktif sampai Anda mengaktifkannya.

## Yang Anda butuhkan

- Semua PC berada di jaringan toko yang sama (Wi-Fi yang sama atau jaringan kabel yang sama).
- Lisensi dengan **kursi** yang cukup. PC toko dihitung satu kursi, dan setiap PC lain yang masuk pada saat yang sama memakai satu kursi lagi. Uji coba gratis mengizinkan dua PC agar Anda bisa mencobanya. Untuk menambah kursi, kirim surel ke alamat yang tertera di layar Lisensi.

## Menyiapkan server (PC yang menyimpan data)

1. Masuk sebagai pemilik. Buka **Settings → Business features → Multi-user**.
2. Pilih **PC ini menyimpan data (server)**.
3. Catat **alamat** yang ditampilkan (misalnya 192.168.1.10:47821) dan **rahasia bersama**. Anda dapat mengganti rahasia kapan saja dengan **Buat rahasia baru**.
4. Tekan **Simpan dan mulai ulang Sarang**.
5. Jika PC lain tidak dapat terhubung, izinkan Sarang melalui firewall Windows di PC ini untuk jaringan pribadi.

## Menyiapkan setiap PC klien

1. Pasang Sarang di PC itu lalu buka.
2. Di halaman masuk, tekan **Pengaturan koneksi PC (beberapa PC)**.
3. Pilih **PC ini terhubung ke PC lain (klien)**. Ketik alamat server dan rahasia bersama, tekan **Uji koneksi**, lalu **Simpan dan mulai ulang Sarang**.
4. Masuk dengan nama pengguna dan kata sandi Anda sendiri. Buat nama pengguna untuk setiap orang di **Settings → Users** agar setiap penjualan dan perubahan menunjukkan siapa yang melakukannya.

## Bekerja bersama

- Setiap orang punya akun masuk dan izin sendiri.
- Jika dua orang menyimpan pada saat yang sama, satu menunggu sebentar yang lain. Nomor seperti nomor faktur tidak pernah berulang. Jika dua orang menjual unit terakhir, hanya satu penjualan yang berhasil.
- Saat seseorang membuka pelanggan, pemasok, atau produk untuk diedit, orang lain yang membuka catatan yang sama melihat **"… membuka ini di PC lain"** dan tidak bisa menyimpan sampai ditutup.
- Saat PC lain mengubah data, muncul catatan kecil: **"… mengubah sebagian data di PC lain. Segarkan."** Tekan Segarkan untuk melihat yang terbaru.
- **Settings → Business features → Multi-user** di server menampilkan siapa yang terhubung dan memungkinkan Anda memutus satu PC.

## Yang hanya berfungsi di PC server

Pencadangan dan pemulihan, impor berkas, tutorial, aktivasi lisensi, membuka dokumen dari disk, dan pencetakan tiket dapur dilakukan di PC server. PC klien mencetak faktur dan menyimpan laporan (Excel, PDF, CSV) di printer dan disknya sendiri.

## Kebiasaan baik

- Jaga server pada daya listrik yang stabil dan buat cadangan setiap hari di server. Klien tidak bisa bekerja saat server mati.
- Jangan menyalin berkas data ke PC lain dan jangan membuka berkas yang sama dari dua PC lewat jaringan. Pakai fitur ini. Membuka satu berkas dari dua PC dapat merusaknya.
- Jaga kerahasiaan rahasia bersama. Jika seseorang keluar dari toko, tekan **Buat rahasia baru** dan ketik yang baru di PC lain.
