# Retail

Memilih **Retail** sebagai jenis bisnis Anda mengaktifkan **Retur** ditambah set modul **Logistik** bersama. Semua yang lain — Billing, Products, Customers, Inventory, Reports — bekerja persis seperti dijelaskan di bab-bab tersebut; bab ini membahas apa yang khusus untuk sebuah toko retail.

## Returns

Buka **Retur** dari sidebar untuk memproses retur atau penukaran pelanggan terhadap penjualan lampau. Cari faktur asli berdasarkan nomor fakturnya, dan Sarang memuat item-itemnya dengan kuantitas **Max Return** untuk masing-masing — ini adalah kuantitas asli dikurangi apa pun yang sudah diretur terhadap faktur yang sama pada kunjungan sebelumnya, sehingga Anda tidak akan pernah tidak sengaja meretur lebih banyak item daripada yang benar-benar dibeli pelanggan (Sarang juga memeriksa dan memblokir ini saat menyimpan, bukan hanya di stepper kuantitas).

Pilih kuantitas untuk diretur untuk setiap item menggunakan stepper +/−, masukkan alasan (wajib), dan kirim. Ini membuat sebuah **faktur retur** yang sesungguhnya (nomor fakturnya sendiri, berawalan `RET-`) yang membalikkan pendapatan, diskon, dan pajak penjualan asli secara proporsional — ini bukan penyesuaian inventaris diam-diam, ini adalah transaksi tertaut nyata yang bisa Anda temukan nanti dari kedua faktur.

## Logistics & Supply Chain

Karena template default Retail mencakup modul Logistics, Anda juga mendapatkan **Armada**, **Kurir**, **Pengiriman**, **Nota Penerimaan Barang**, **Surat Jalan**, **Buku Besar Ongkir**, dan **Analitik Logistik** untuk melacak kendaraan pengiriman Anda sendiri dan pengiriman dari pemasok — lihat layar Logistics di bawah nama-nama tersebut di sidebar.

## Laporan

Buka **Laporan → Daftar Pembersihan Stok Mati** untuk melihat setiap produk yang masih ada stoknya tanpa penjualan dalam 90 hari terakhir — grafik batang plus tabel lengkap, diurutkan sehingga produk yang mengunci uang paling banyak berada di atas, bukan hanya yang paling lama. Setiap baris menampilkan stok produk saat ini, biayanya, dan **modal mengendap** yang dihasilkan (stok × biaya) — jumlah uang nyata yang tidak melakukan apa-apa di rak Anda. Produk yang tidak pernah terjual menampilkan "Tidak Pernah Terjual" alih-alih tanggal penjualan terakhir — perbedaan jujur dari produk yang hanya belum terjual baru-baru ini. Gunakan daftar ini untuk memutuskan mana yang benar-benar memerlukan markdown, bundel, atau dorongan pembersihan — bukan tebakan berdasarkan rak mana yang terlihat berdebu.

Buka **Laporan → Tingkat Penjualan per Kategori** di bilah sisi untuk melihat, bulan demi bulan, seberapa banyak stok yang tersedia dari setiap kategori produk benar-benar terjual — grafik batang berkelompok ditambah tabel lengkap, satu batang per kategori per bulan. Setiap batang menunjukkan bagian dari unit terjual-ditambah-stok kategori tersebut yang terjual pada bulan itu: kategori yang bergerak cepat berada tinggi, yang menumpuk diam-diam berada rendah. Setiap bulan yang ditampilkan dibandingkan dengan stok SAAT INI yang tersedia, bukan tingkat stok historis bulan itu sendiri, jadi bacalah ini sebagai tampilan tren tentang apa yang sedang laku sekarang, bukan riwayat bulan-demi-bulan yang tepat — sungguh berguna untuk mengenali kategori mana yang layak mendapat lebih banyak ruang rak atau pemesanan ulang yang lebih besar, dan mana yang perlu diperlambat, tanpa harus meninjau puluhan produk satu per satu.

Buka **Laporan → Komposisi Keranjang** di bilah sisi untuk melihat produk mana yang paling sering dibeli bersamaan oleh pelanggan Anda dalam penjualan yang sama — grafik batang ditambah tabel lengkap setiap pasangan produk, diurutkan berdasarkan berapa banyak keranjang yang berisi keduanya. Ringkasan yang menyertainya menunjukkan jumlah total keranjang dalam periode tersebut, rata-rata jumlah barang berbeda per keranjang, dan nilai rata-rata keranjang. Gunakan ini untuk memutuskan apa yang harus diletakkan berdampingan di rak, atau penawaran paket mana yang benar-benar didukung oleh perilaku pembelian nyata, bukan tebakan.

## Markdown Harga

Buka **Markdown Harga** dari bilah sisi untuk memotong harga produk untuk waktu terbatas dan membiarkannya kembali sendiri — tidak perlu mengingat untuk mengubahnya kembali. Pilih produk, atur harga markdown, dan pilih tanggal saat harga tersebut harus berakhir; harga baru berlaku pada produk segera, dan Sarang otomatis memulihkan harga asli setelah tanggal tersebut berlalu (diperiksa saat aplikasi dimulai dan sekitar setiap jam, jadi Anda tidak perlu membuka aplikasi pada saat yang tepat itu). Hanya satu markdown yang dapat aktif pada satu produk pada satu waktu — batalkan yang sedang berjalan terlebih dahulu jika Anda perlu mengubah ketentuannya.

Jika Anda sendiri mengubah harga jual produk itu saat markdown masih berjalan, Sarang menyadarinya: pengembalian otomatis dilewati alih-alih menimpa perubahan manual Anda, dan markdown tersebut hanya ditutup dengan tanda "Diubah Manual" alih-alih "Dikembalikan" — sehingga markdown tidak akan pernah diam-diam membatalkan keputusan harga yang Anda buat dengan sengaja. Gunakan **Batalkan** pada markdown aktif untuk mengakhirinya lebih awal — jika harga belum diubah sejak markdown dimulai, harga langsung kembali ke aslinya; jika sudah, membatalkan hanya menghentikan pelacakan markdown tanpa menyentuh harga. **Periksa Sekarang** di layar ini menjalankan pemeriksaan pengembalian yang sama sesuai permintaan, jika Anda tidak ingin menunggu siklus otomatis berikutnya.

## Program Loyalitas

Buka **Program Loyalitas** di bilah sisi untuk menjalankan hadiah kartu cap sederhana — atur berapa banyak kunjungan yang menghasilkan hadiah dan apa hadiah itu (barang gratis, persentase diskon, apa pun yang ingin Anda tawarkan). Setelah diaktifkan, cap ditambahkan secara otomatis ke kartu pelanggan pada setiap penjualan yang memenuhi syarat — tidak ada langkah tambahan saat checkout, dan Anda dapat mengatur jumlah pembelian minimum jika hanya ingin memberikan cap pada penjualan di atas jumlah tertentu.

Layar ini menampilkan kemajuan setiap pelanggan saat ini menuju hadiah berikutnya, beserta berapa total cap yang telah mereka peroleh dan berapa hadiah yang sudah mereka tukarkan. Setelah pelanggan mencapai target, gunakan **Tukarkan** di sini untuk memberikan hadiah mereka — ini menggunakan tepat jumlah cap yang dibutuhkan, jadi cap ekstra di luar target akan dibawa ke hadiah berikutnya, bukan hilang.

## Yang dibagikan dengan setiap bisnis

Billing, invoicing, payments, Customers, Products, Reports, Backup, dan Users & Permissions semuanya bekerja persis seperti dijelaskan di bab masing-masing. Sebuah toko retail juga dapat mengaktifkan tambahan lintas-sektor secara independen dari **Settings → Additional Business Features** — pembuatan/pencetakan Barcode dan penagihan Loose/Weight adalah pilihan umum untuk sebuah toko retail, tetapi nonaktif secara default dan tidak khusus untuk jenis bisnis Retail.
