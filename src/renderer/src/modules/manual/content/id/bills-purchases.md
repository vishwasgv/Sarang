# Tagihan dan Pembayaran yang Dilakukan

## Apa itu Tagihan, dan bagaimana bedanya dengan Pesanan Pembelian

**Pesanan Pembelian** adalah apa yang Anda *pesan* dari pemasok. **Tagihan** adalah apa yang sebenarnya *ditagihkan* kepada Anda — kedua dokumen ini terkait tetapi tidak sama. Anda dapat mencatat tagihan tanpa pernah membuat pesanan pembelian sama sekali (kasus umum untuk faktur subkontraktor, tagihan sewa, atau pembelian ad-hoc apa pun), atau Anda dapat menautkan tagihan ke pesanan pembelian yang sudah ada sebagai referensi.

Setiap tagihan meningkatkan jumlah yang Anda hutang ke pemasok tersebut. Status tagihan bergerak melalui **Terbuka → Sebagian Dibayar → Dibayar** seiring Anda mencatat pembayaran terhadapnya, atau dapat **Dibatalkan** jika salah dicatat (hanya selama belum ada pembayaran yang tercatat — balikkan pembayaran apa pun terlebih dahulu).

## Mencatat Tagihan

Buka **Tagihan** di sidebar dan klik **Catat Tagihan**. Pilih pemasok (atau tambahkan pemasok baru langsung tanpa meninggalkan layar — pintasan **+ Tambah Pemasok Baru** yang sama juga tersedia di formulir Pesanan Pembelian), lalu tambahkan satu atau lebih item baris.

Setiap baris adalah salah satu dari:

- **Produk** — item nyata dari katalog produk Anda, dipilih dari menu dropdown yang dapat dicari. Biayanya otomatis terisi dari harga pokok produk itu sendiri, dan Anda dapat menyesuaikannya jika pembelian khusus ini memiliki harga yang berbeda.
- **Layanan** — teks bebas (mis. "Kontrak pemeliharaan — triwulanan", "Biaya konsultasi hukum"), opsional ditandai dengan kategori. Inilah yang menutup celah lama di mana setiap pembelian bisnis non-jual-kembali — peralatan kantor, barang habis pakai, biaya profesional — tidak memiliki tempat terstruktur sama sekali. Campurkan baris produk dan layanan secara bebas dalam tagihan yang sama.

Setiap baris juga memiliki jumlah diskon dan tarif pajaknya sendiri, sehingga total tagihan dihitung dengan benar per baris sebelum dijumlahkan — urutan diskon-lalu-pajak yang sama yang sudah diikuti setiap dokumen lain di Sarang.

## Mencatat Pembayaran terhadap Tagihan

Buka tagihan dan klik **Catat Pembayaran**. Pembayaran pemasok menerima Tunai, UPI, Kartu, Transfer Bank, atau Cek — kumpulan yang lebih luas daripada pembayaran yang menghadap pelanggan, karena pembayaran B2B secara rutin dilakukan melalui transfer bank atau cek. Pembayaran bisa sebagian; saldo dan status tagihan segera diperbarui, dan jumlahnya dikurangi dari yang Anda hutang ke pemasok tersebut.

Setiap pembayaran yang Anda lakukan di semua tagihan juga muncul di satu tempat di bawah **Pembayaran yang Dilakukan** di sidebar — dapat dicari berdasarkan nomor tagihan, pemasok, atau nomor referensi, dengan dukungan pembalikan yang sama (dengan alasan yang wajib) yang sudah dimiliki Pembayaran Diterima, jika ada yang salah dicatat.

## Laporan sisi pembelian

Empat laporan, semuanya di bawah **Laporan**, mencakup apa yang telah Anda beli dan apa yang Anda hutang:

- **Daftar Pembelian** — setiap tagihan dalam rentang tanggal, dengan grafik pengeluaran per vendor dan detail tingkat baris lengkap. Ini adalah padanan sisi pembelian dari Laporan Penjualan.
- **Pembelian per Vendor** — total pengeluaran dan jumlah tagihan, diurutkan berdasarkan pemasok, untuk mengetahui dari siapa Anda sebenarnya paling banyak membeli.
- **Pembelian per Barang** — total pengeluaran dan jumlah yang dibeli, diurutkan berdasarkan produk atau layanan, memisahkan barang inventaris nyata dari baris layanan teks bebas.
- **Ringkasan Umur Hutang** — berapa yang saat ini Anda hutang ke setiap pemasok, dikelompokkan berdasarkan seberapa lama terlambat (Saat ini / 1-30 / 31-60 / 61-90 / 90+ hari), logika umur yang sama yang sudah digunakan Laporan Saldo Terhutang untuk sisi pemasok, kini sebagai tampilan khususnya sendiri.

## Kedalaman lebih pada catatan vendor

Catatan pemasok itu sendiri (buka dari **Pemasok**) kini juga dapat menyimpan rekening bank/kode IFSC/nama bank (untuk melakukan pembayaran) dan nomor PAN (untuk keperluan kepatuhan), serta **Saldo Awal** saat Anda pertama kali menambahkan pemasok yang sudah memiliki hutang nyata — ini mencatat satu entri sekali pakai pada buku besar mereka sehingga saldo mereka benar sejak hari pertama.

## Pelanggan Individu vs. Bisnis

Catatan pelanggan (buka dari **Pelanggan**) kini dimulai dengan sakelar **Individu / Bisnis**. Bisnis mengaktifkan bidang nomor registrasi perusahaan dan nama kontak yang ditunjuk; Individu sebagai gantinya mengaktifkan jenis dan nomor bukti identitas — ini sesuai dengan apa yang sebenarnya perlu dicatat oleh distributor atau penjual B2B tentang kepada siapa mereka menjual, berbeda dari pelanggan ritel yang datang langsung.

## Pengeluaran: Vendor, Jarak Tempuh, dan Dapat Ditagihkan ke Pelanggan

Formulir **Pengeluaran** kini juga menerima vendor/pemasok opsional (untuk pengeluaran yang memiliki vendor nyata tetapi tidak memerlukan tagihan lengkap), rincian jarak tempuh (jarak × tarif per km, yang menghitung jumlahnya untuk Anda sehingga kedua angka tidak akan pernah tidak sesuai), dan bidang **Tagihkan ini ke pelanggan** untuk pengeluaran yang dapat diganti yang Anda rencanakan untuk ditagihkan kembali — misalnya, perjalanan yang kemudian ditagihkan konsultan ke pelanggan.
