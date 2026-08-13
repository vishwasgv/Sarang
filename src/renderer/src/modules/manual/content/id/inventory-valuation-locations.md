# Valuasi Inventaris dan Stok Multi-Lokasi

## Metode Valuasi

Sekarang setiap produk memiliki **Metode Valuasi**, yang diatur pada formulir produk: **Rata-Rata Tertimbang** (default — biaya yang Anda lihat adalah rata-rata berjalan di setiap pembelian), **FIFO** (Masuk Pertama, Keluar Pertama — biaya mencerminkan lapisan pembelian tertua yang masih ada di stok Anda), atau **Biaya Standar** (biaya tetap yang Anda tentukan sendiri, yang tidak berubah seiring harga pembelian). Metode apa pun yang digunakan suatu produk, itulah angka biaya yang digunakan Sarang di setiap tempat biaya itu penting untuk produk tersebut — margin di Dasbor, laporan Laba Rugi, laporan Biaya Makanan, dan saran draf pemesanan ulang semuanya membaca biaya yang sama yang telah ditentukan, sehingga tidak pernah saling bertentangan.

Mengubah metode valuasi suatu produk tidak menulis ulang riwayat pembeliannya — ini hanya mengubah angka mana yang dibaca Sarang mulai sekarang.

## Lokasi dan Transfer Stok

**Lokasi** (`/locations`) untuk bisnis yang menyimpan stok di lebih dari satu tempat — gudang ditambah konter ritel, atau dua cabang. Setiap bisnis dimulai dengan satu lokasi default "Utama" tempat semua stok yang ada saat ini sudah tergabung, jadi tidak ada yang berubah sampai Anda benar-benar menambahkan lokasi kedua. Tambahkan satu dengan **Lokasi Baru** (nama dan alamat opsional); lokasi pertama yang dibuat selalu menjadi default, dan lokasi default tidak dapat dinonaktifkan karena setiap pergerakan stok yang tidak menyebutkan lokasi tertentu akan diarahkan ke sana.

Setelah lokasi kedua ada, tindakan **Transfer Stok** akan muncul: pilih produk, jumlah, lokasi asal dan tujuan, dan alasan opsional. Transfer hanya memindahkan stok antar lokasi — tidak pernah mengubah total yang Anda miliki, jadi ini tidak membuat pergerakan inventaris baru jenis "stok ditambahkan" atau "stok dihapus", hanya perubahan dari satu lokasi ke lokasi lain.

## Biaya Landed

**Biaya Landed** memungkinkan Anda memasukkan biaya tambahan sisi pembelian — ongkos kirim, bea cukai, penanganan, atau lainnya — ke dalam biaya sebenarnya suatu produk, alih-alih membiarkannya sebagai pengeluaran terpisah yang tidak teratribusi.

Pada **Pesanan Pembelian**, tambahkan biaya landed dari layar detailnya: pilih jenis (Ongkos Kirim, Bea Masuk, Penanganan, atau Lainnya), jumlah, dan cara menyebarkannya ke seluruh baris pesanan — **berdasarkan nilai baris** (baris bernilai lebih besar dalam pesanan menyerap bagian biaya yang lebih besar) atau **berdasarkan jumlah** (disebar merata per unit terlepas dari harga). Anda dapat menambah atau menghapus biaya landed secara bebas hingga PO pertama kali diterima; setelah penerimaan dimulai, biaya tersebut terkunci, karena riwayat biaya yang diisinya tidak pernah ditulis ulang setelahnya. Pada **Tagihan**, biaya landed dimasukkan inline hanya saat pembuatan, dalam bagian opsional — Tagihan langsung memposting riwayat biayanya, tanpa langkah "penerimaan" terpisah untuk menambahkan biaya nanti.

Bagaimanapun caranya, biaya landed dimasukkan ke dalam biaya per unit yang tercatat untuk pembelian tersebut, yang persis merupakan apa yang kemudian dibaca oleh metode valuasi Anda (di atas).

## Barang Komposit (Kit)

**Kit** adalah produk yang terdiri dari produk lain, dijual dan disimpan sebagai satu item tetapi harganya ditentukan dan diinventarisasi melalui komponen sebenarnya. Ubah produk menjadi kit dari formulirnya sendiri: centang **Ini adalah Kit** dan pilih komponennya (masing-masing harus produk Standar sungguhan yang ada di stok — layanan dan kit lain tidak dapat ditambahkan sebagai komponen, karena stok kit harus dapat ditelusuri kembali ke sesuatu yang benar-benar ada di rak).

Saat Anda menjual kit, faktur tetap menampilkan satu baris dengan harga kit itu sendiri — tidak ada yang berubah bagi pelanggan atau kasir. Di balik layar, Sarang memeriksa bahwa setiap komponen memiliki stok yang cukup sebelum mengizinkan penjualan, lalu mengurangi jumlah sebenarnya dari setiap komponen, sehingga hitungan stok tingkat komponen Anda selalu tetap akurat meskipun yang terjual adalah kit.

## PO Otomatis Berdasarkan Level Pemesanan Ulang

**Level Pemesanan Ulang** setiap produk sudah ada untuk memicu peringatan stok rendah (lihat bab *Inventaris*); ambang batas yang sama ini sekarang juga menggerakkan **pembuatan draf Pesanan Pembelian**. Dari layar Inventaris, membuat draf pemesanan ulang mengelompokkan setiap produk di bawah ambang batas berdasarkan pemasok biasanya dan membuat satu PO Draf per pemasok, yang sudah diisi sebelumnya dengan jumlah pemesanan ulang yang disarankan dan biaya yang telah ditentukan saat ini untuk produk tersebut — Anda tetap meninjau dan menyetujui masing-masing sebelum menjadi nyata, tidak ada yang dikirim secara otomatis ke pemasok.

## Konversi Unit Mengambang (GRN)

Beberapa barang yang dibeli tidak dikonversi ke unit penjualan Anda dengan rasio yang benar-benar tetap — "satu karung beras" mungkin secara nominal 25 kg, tetapi karung yang benar-benar Anda terima mungkin beratnya 24,6 kg. Aktifkan **Konversi Unit Mengambang** pada produk (bersama pengaturan penjualan paket/berat yang sudah ada) untuk menangkap hal ini pada saat penerimaan: pada **GRN** (Nota Penerimaan Barang), muncul kolom **Jumlah Unit Pembelian** di sebelah baris tersebut — masukkan berapa banyak karung yang Anda terima, sementara kolom **Diterima** yang sudah ada tetap menjadi jumlah nyata yang diukur yang benar-benar diambil ke dalam stok. Kedua angka ini boleh berbeda; Sarang menurunkan faktor konversi sebenarnya untuk penerimaan spesifik tersebut dari dua angka yang Anda masukkan, alih-alih mengasumsikan setiap karung beratnya tepat 25 kg.
