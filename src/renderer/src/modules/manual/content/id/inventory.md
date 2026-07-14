# Inventaris

## Menambah dan mengedit produk

Buka **Produk** dari sidebar untuk melihat daftar produk lengkap Anda, yang dapat difilter berdasarkan kategori. Klik **Tambah Produk** untuk membuat satu produk baru, atau ikon edit pada baris mana pun untuk mengubahnya. Kolom inti sebuah produk adalah:

- **Nama Produk**, **SKU**, **Barcode**, **Kode HS / Item**, dan **Deskripsi** singkat.
- **Jenis Produk** — Standar (barang fisik dengan stok yang dilacak) atau Layanan (tidak ada stok untuk dilacak, misalnya biaya tenaga kerja).
- **Satuan** — pilih dari daftar tetap (PCS, KG, G, L, ML, M, CM, SQFT, SQM, BOX, DOZEN, PACKET, PAIR, SET, BOTTLE, BAG, ROLL, HOUR, SERVICE).
- **Harga Pokok**, **Harga Jual**, dan **Tarif Pajak** — tarif pajak bisa diketik bebas, atau diterapkan dengan satu klik dari tarif mana pun yang dikonfigurasi di **Settings → Tax Configuration**.
- **Tingkat Reorder** dan **Kuantitas Reorder** — ambang batas stok yang memicu peringatan stok rendah, dan berapa banyak yang biasanya Anda pesan ulang.
- **Kuantitas Awal** — jumlah stok untuk memulai saat produk pertama kali dibuat.
- **Gambar produk** opsional.

**Kategori** dikelola dari tombol **Category** pada layar Produk, memungkinkan Anda mengelompokkan produk untuk difilter dan dilaporkan.

Beberapa jenis produk bersifat opt-in dan hanya ditampilkan ketika fitur yang sesuai diaktifkan untuk bisnis Anda (dari **Settings → Additional Business Features** atau template jenis bisnis Anda sendiri): penjualan-per-berat/penagihan lepas, varian ukuran/warna, barang yang dapat disewakan, dan penetapan harga logam perhiasan. Ini bersifat opt-in per produk — mengaktifkan sebuah fitur tidak memaksa setiap produk masuk ke mode itu. Pelacakan batch/kedaluwarsa, pelacakan serial/IMEI, dan perilaku stok khusus jenis-bisnis lainnya dibahas di bab jenis-bisnis yang relevan, bukan di sini.

## Tingkat stok dan pergerakan

**Inventaris** (`/inventory`) mendaftar stok saat ini setiap produk, tingkat reorder, biaya rata-rata, dan nilai stok, dengan hitungan berjalan item stok rendah dan stok habis yang ditampilkan sebagai lencana peringatan di bagian atas. Beralih antara **Semua** dan **Stok Rendah** menggunakan tab.

Untuk mengoreksi jumlah stok secara manual — setelah penghitungan fisik, kerusakan, atau saldo awal — klik ikon sesuaikan-stok pada sebuah baris. Masukkan kuantitas baru (bukan selisihnya); layar akan menampilkan berapa banyak yang akan ditambahkan atau dikurangi sebelum Anda menyimpan, dan mewajibkan sebuah alasan. Jika Anda menambah stok, Anda dapat secara opsional mencatat biaya per unit untuk penambahan tersebut, yang akan masuk ke biaya rata-rata produk yang digunakan untuk penilaian (valuasi).

Setiap perubahan pada stok — penjualan, penyesuaian manual, pesanan pembelian yang diterima, retur, atau proses produksi — dicatat sebagai **pergerakan** (movement) yang tidak dapat diubah. **Inventory Movements** (`/inventory/movements`, dibuka melalui tombol **Pergerakan**) adalah buku besar hanya-baca dari setiap pergerakan ini, dapat difilter berdasarkan jenis (Stock Added, Sale, PO Received, Adjustment, Sale Return, Return Received, Dispatched, Produced) dan dapat dicari, sehingga Anda selalu bisa melacak persis mengapa stok sebuah produk seperti sekarang.

## Pesanan Pembelian

**Pesanan Pembelian** (`/purchase-orders`) melacak apa yang telah Anda pesan dari pemasok. Buat satu dengan **New PO**: pilih pemasok, tambahkan baris item (dicari berdasarkan nama produk atau SKU) dengan kuantitas, biaya satuan, dan tarif pajak, serta tanggal pengiriman yang diharapkan (opsional).

Sebuah pesanan pembelian melalui siklus hidup yang tetap:

1. **Draft** — masih bisa diedit.
2. **Approve** untuk menguncinya dari perubahan lebih lanjut.
3. **Receive Stock** — ini adalah langkah yang benar-benar menambahkan kuantitas yang dipesan ke inventaris Anda dan mencatat pergerakan PURCHASE untuk setiap item. Setelah diterima, PO menampilkan tingkat stok hasil setiap item di samping baris pesanan.
4. PO berstatus Draft atau Approved dapat dibatalkan (**Cancel PO**) dengan alasan.

## Visibilitas stok rendah

Hitungan stok rendah dan stok habis muncul di tiga tempat yang selalu selaras: lencana peringatan di bagian atas layar Inventaris, ubin stok-rendah dan stok-habis di Dasbor, dan filter stok-rendah di layar Produk/Inventaris. Menetapkan tingkat reorder yang masuk akal pada setiap produk (defaultnya 5) adalah yang membuat peringatan ini berguna — produk tanpa tingkat reorder yang ditetapkan secara efektif tidak akan pernah memicu peringatan stok rendah.
