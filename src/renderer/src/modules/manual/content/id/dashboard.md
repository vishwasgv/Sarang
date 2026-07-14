# Dasbor

## Apa yang Anda lihat saat masuk

**Dasbor** adalah layar utama Sarang. Di bagian atas terdapat nama bisnis Anda, tanggal hari ini, dan tombol **Refresh** yang memaksa pembacaan ulang setiap angka di halaman (angka-angka tersebut biasanya di-cache sebentar demi kecepatan).

Jika **Ask Sarang** (AI Assistant) telah diaktifkan di **Settings → Additional Business Features**, sebuah kotak tanya-cepat muncul tepat di bawah header — ketik pertanyaan berbahasa Inggris sederhana tentang penjualan, stok, pelanggan, atau laba Anda dan itu akan membuka layar **Ask Sarang** dengan jawabannya.

Bisnis baru melihat daftar periksa singkat **Getting Started** di sini (tambahkan produk pertama Anda, tambahkan pelanggan, buat faktur pertama Anda) sampai ketiganya selesai atau Anda menutupnya.

## Peringatan

Di atas ubin KPI, Sarang menampilkan sejumlah kecil peringatan yang dapat ditindaklanjuti ketika berlaku untuk Anda, masing-masing berwarna peringatan (kuning) atau bahaya (merah) tergantung tingkat keparahannya:

- **Stok rendah** — satu atau lebih produk berada pada atau di bawah tingkat reorder mereka.
- **Tidak ada cadangan / cadangan terlambat** — tidak pernah ada cadangan yang dibuat, atau sudah lebih lama dari interval pengingat Anda sejak yang terakhir.
- **Saldo tertunggak besar** — total tertunggak pelanggan telah melewati ambang batas.
- **Pengingat tertunda** — pengingat layanan/janji temu dalam antrean tetapi belum dikirim (dengan tautan satu-klik untuk meninjaunya).
- **Kegagalan log audit** — sebuah tindakan baru-baru ini tidak bisa ditulis ke log audit, layak untuk memeriksa ruang disk/izin.
- **Sewa terlambat** — satu atau lebih barang yang disewakan terlambat dikembalikan (bisnis Rental).

## Ubin KPI

Grid utama ubin mencakup: **Penjualan Hari Ini**, **This Week's Sales**, **This Month's Sales** (masing-masing dengan persentase tren terhadap periode sebelumnya), **Saldo Tertunggak**, **Inventaris** (nilai stok), **Total Pengeluaran** bulan ini, **Estimasi Laba** bulan ini, **Stok Rendah** (sebuah hitungan), **Pelanggan** (sebuah hitungan), dan **Pemasok** (sebuah hitungan). Ubin untuk pendapatan, nilai inventaris, pengeluaran, dan laba disembunyikan di balik tingkat izin Anda — jika Anda tidak memiliki izin analitik yang relevan, ubin menampilkan "—" alih-alih angka daripada dihilangkan sepenuhnya.

Bisnis bertipe Restaurant dengan KOT aktif juga melihat dua ubin tambahan di atas grid untuk KOT yang menunggu dan KOT yang sedang diproses, masing-masing tertaut langsung ke layar pesanan dapur.

## Grafik dan rincian

Di bawah ubin: grafik tren pendapatan-vs-pengeluaran yang bisa Anda beralih antara Hari Ini/Minggu/Bulan/Kuartal/Tahun atau rentang tanggal khusus, dan grafik batang Produk Terlaris. Di bawahnya, rincian Saldo Tertunggak (pelanggan teratas Anda berdasarkan jumlah yang terutang) berada di samping bar Kesehatan Inventaris yang menunjukkan pembagian antara produk aktif, rendah, dan habis stok.

## Aktivitas Terbaru dan Tindakan Cepat

Panel kiri-bawah mendaftar tindakan tercatat terbaru Anda di seluruh sistem (siapa melakukan apa, dan kapan). Panel kanan-bawah memiliki pintasan satu-klik untuk tindakan yang paling sering digunakan pemilik: Faktur Baru, Tambah Produk, Tambah Pelanggan, Laporan, Inventaris, dan Cadangan.

## Sorotan Industri

Sebuah kartu kecil di bawah Tindakan Cepat menyesuaikan dengan jenis bisnis Anda, menampilkan dua atau tiga metrik yang paling relevan untuknya — misalnya bisnis Restaurant melihat pendapatan hari ini, bahan stok-rendah, dan meja yang terisi; bisnis Jewellery melihat harga logam hari ini dan tarif yang dikonfigurasi; sebuah Distributor melihat tagihan tertunggak dan pemasok aktif. Bisnis Retail umum melihat kategori terlaris dan item stok-rendahnya. Jenis bisnis mana pun tanpa sorotan khusus akan kembali ke tampilan Retail.
