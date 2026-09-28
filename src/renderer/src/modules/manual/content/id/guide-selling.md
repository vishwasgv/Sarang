# Panduan: Menjual, dari Penawaran hingga Uang

Semua yang Anda lakukan saat pelanggan membeli, sesuai urutannya. Lewati langkah yang tidak perlu: toko yang menagih di kasir hanya perlu langkah 4.

```
Penawaran  ->  Pesanan Penjualan  ->  Faktur (Penagihan)  ->  Pembayaran  ->  (Retur / Nota Kredit)
 opsional        opsional              selalu                  saat dibayar     hanya jika ada barang kembali
```

## 1. Tambahkan pelanggan (sekali saja)

**Sales → Pelanggan → Add Customer.** Isi nama dan telepon. Tambahkan alamat, surel, dan nomor pajak (GSTIN) jika Anda menagih usaha. Pilih **Individual** atau **Business**; usaha juga meminta nomor registrasi perusahaan dan seorang kontak.

- **Cari sebelum menambah.** Ketik nomor telepon lebih dulu. Sarang memblokir pelanggan kedua dengan nomor telepon yang sama, sehingga satu orang tidak pernah menjadi dua catatan. Sarang juga memeriksa GSTIN dan surel, dan tombol **Find duplicates** di layar Pelanggan menampilkan catatan yang tampak seperti orang yang sama agar Anda bisa **menggabungkannya**. Penggabungan memindahkan semua faktur dan pembayaran ke catatan yang Anda pertahankan dan tidak dapat dibatalkan.
- **Batas kredit**: atur untuk pelanggan yang membeli secara kredit. Sarang tidak akan membiarkan penjualan membuat mereka melewati batas.
- **Ketentuan pembayaran**: ketik jumlah hari yang biasanya diberikan kepada pelanggan ini untuk membayar (misalnya 30). Setiap faktur baru untuknya lalu otomatis mendapat tanggal jatuh tempo.
- **Alamat lain**: di halaman pelanggan, **Other addresses** menyimpan alamat pengiriman, gudang, atau cabang di samping alamat utama.
- **Bebas pajak**: centang untuk pelanggan yang tidak boleh dikenai pajak. Anda dapat mencatat nomor sertifikat pembebasan dan tanggal berlakunya. Setelah tanggal itu Sarang mengenakan pajak lagi, dan formulir pelanggan memberi tahu bahwa sertifikat telah kedaluwarsa.
- **Jangan kirim pesan ke pelanggan ini**: centang jika mereka meminta tidak menerima pengingat atau penawaran. Pengingat yang menunggu untuk mereka dihapus dan tidak ada yang baru ditawarkan untuk dikirim.
- **Laporan rekening**: tombol **Statement** di halaman pelanggan membuka akun mereka (setiap faktur, pembayaran, dan nota kredit dengan saldo berjalan) siap dicetak atau dikirim.
- **Arsipkan, jangan hapus**, pelanggan yang tidak Anda layani lagi. Riwayatnya tetap ada.

Anda juga dapat menambah pelanggan langsung saat menagih (**+ Add Customer**, hanya nama dan telepon).

## 2. Memberi harga: Penawaran (opsional)

**Sales → Penawaran → New Quotation.** Pilih pelanggan (atau ketik nama), tambahkan barang, dan atur **Valid until** (hari terakhir harga berlaku). Simpan sebagai Draf, cetak atau bagikan lewat WhatsApp, lalu tandai **Sent**.

- Saat pelanggan setuju, buka lalu klik **Convert to Invoice** (atau **Convert to Sales Order** untuk pelanggan yang sudah berkomitmen tetapi belum ditagih). Penawaran menjadi **Accepted**.
- **Penawaran kedaluwarsa dengan sendirinya.** Sehari setelah *Valid until*, penawaran Draf atau Terkirim menjadi **Expired**. Penawaran yang kedaluwarsa tidak bisa dikonversi. Jika Anda memutuskan menghormatinya, ubah statusnya kembali ke **Sent**; Sarang menghapus kedaluwarsa lama agar tidak kedaluwarsa lagi pada jam yang sama. Pakai filter **Expired** untuk melihat siapa yang tidak membalas.
- **Faktur proforma**: pilih *Proforma invoice* sebagai jenis dokumen saat Anda perlu meminta pembayaran di muka. Bernomor PF-, tercetak sebagai "PROFORMA INVOICE, Not a tax invoice" dan dikonversi menjadi faktur sungguhan seperti penawaran.
- Pajak tiap baris berasal dari produk; Anda dapat mengubahnya di baris.

## 3. Mengonfirmasi pesanan: Pesanan Penjualan (opsional)

**Sales → Pesanan Penjualan → New Sales Order.** Pakai saat pelanggan sudah bilang ya tetapi Anda belum bisa menagih (barang belum siap, menunggu uang muka).

1. **New Sales Order**: pelanggan, tanggal perkiraan, barang. Setiap barang mengambil harga dan tarif pajak produk.
2. **Confirm Order** untuk mengunci. (Jika ada aturan persetujuan, menunggu persetujuan dulu.)
3. **Create Invoice** saat siap. Anda dapat menagih sebagian sekarang dan sisanya nanti; pesanan melacak berapa yang sudah ditagih (*Partially Invoiced* lalu *Invoiced*).

Pesanan Penjualan yang terbuka **menjanjikan** stok: **Inventaris** dan laporan Stock Summary menunjukkan berapa yang dijanjikan pada pesanan, dan Sarang memperingatkan saat Anda mengonfirmasi pesanan melebihi yang tersedia. Ini hanya peringatan: tidak ada yang menghalangi Anda menjual stok yang dijanjikan, jadi periksa sebelum menjanjikan unit terakhir. Pesanan tidak menyentuh pembukuan Anda sampai Anda menagih.

## 4. Menjual: layar Penagihan (pekerjaan utama)

**Sales → Penagihan.** Ini layar penjualan.

1. **Tambahkan barang.** Cari berdasarkan nama, SKU, atau barcode, atau ketuk ubin produk. Produk yang sering dijual tampil sebagai ubin di atas kotak pencarian. Pakai **Browse Products** untuk menelusuri kategori tanpa mengetik.
2. **Atur jumlah dan diskon** pada tiap baris. Tombol kecil di samping diskon beralih antara **persen**, **jumlah**, dan **harga tawar/akhir** (ketik harga yang disepakati dan Sarang menghitung diskonnya).
3. **Pilih pelanggan** (atau kosongkan untuk pembeli langsung).
4. **Pilih cara pembayaran**: Tunai, UPI, Kartu, Dompet, **Kredit (bayar nanti)** (perlu pelanggan; faktur tetap belum dibayar dan menambah utang mereka), atau **Split** (misalnya sebagian tunai, sebagian UPI).
5. **Pajak.** Pajak berasal dari tiap produk. Jika Anda memakai GST, **Tax shown as** memilih CGST + SGST, IGST, atau satu baris GST; Sarang memilih dari dua negara bagian dan Anda dapat mengubahnya. Jumlah pajaknya sama apa pun cara menampilkannya. Lihat *Guide: Tax and GST*.
6. **Tambahan pada faktur.**
   - **Add Charge** menambah baris untuk tip, ongkir atau pengiriman, pengemasan, penanganan, pemasangan, atau biaya lain. Isi jumlahnya dan, kecuali untuk tip, tarif pajak yang berlaku.
   - **Give free** (di bawah nama baris) mengubah seluruh baris menjadi contoh gratis atau hadiah: stok tetap keluar, harga dan pajak menjadi nol, dan faktur menandainya gratis.
   - **Export sale?** muncul saat pelanggan berada di negara lain. Centang untuk tidak mengenakan pajak pada penjualan ini (ekspor tarif nol). Sarang tidak pernah melakukannya sendiri, dan catatan faktur berbunyi "Export supply, zero-rated". Periksa aturan ekspor negara Anda dan simpan bukti ekspor.
7. Periksa total. Total dibulatkan sesuai aturan yang Anda pilih di **Pengaturan → Currency & Locale → Invoice rounding** (tanpa, terdekat 0,05, 0,10, 0,50 atau 1). Pembulatan tampil sebagai baris tersendiri.
8. **Confirm Sale** (atau tekan **F10** atau **Ctrl + Enter**). Faktur terbuka.

**Melayani dua pelanggan sekaligus?** **Hold Sale** menyimpan keranjang; **Resume Sale** mengembalikannya.

**Harga atau barang salah?** Perbaiki sebelum konfirmasi. Setelah konfirmasi, faktur tidak bisa diedit; batalkan (dengan alasan) dan buat yang baru, atau pakai Nota Kredit untuk koreksi sebagian.

**Mengirim barang ke pelanggan di India?** Untuk penjualan GST senilai 50.000 atau lebih, Sarang mengingatkan Anda soal e-way bill dan memungkinkan Anda menyimpan nomornya di faktur. Detail lain surat jalan (pengangkut, nomor LR) ada di **Create Delivery Note**.

## 5. Memberikan salinan kepada pelanggan

Di layar faktur:

- **Print** (A4) atau **Print Receipt** (gulungan termal).
- **Share on WhatsApp** atau **Email**: Sarang membuka WhatsApp atau surel Anda dengan pesan siap. Lampirkan PDF yang disimpan dan tekan Kirim sendiri. Tidak ada yang terkirim tanpa Anda.
- **Create Delivery Note** jika Anda mengirim barang keluar.

## 6. Menerima uang

- **Dibayar di kasir**: Anda memilih metode di langkah 4; faktur sudah Lunas.
- **Dibayar nanti**: buka faktur (**Penagihan → daftar faktur**) dan klik **Record Payment**. Isi jumlah (sebagian atau penuh), metode, dan referensi. Pembayaran sebagian membuat faktur **Partial**.
- **Pelanggan membayar lebih sedikit karena menahan pajak penghasilan (TDS)?** Di jendela pembayaran pilih **TDS deducted** dan isi pajak yang mereka tahan. Ini menyelesaikan bagian faktur itu tanpa ada uang yang masuk, dan Sarang mencatatnya sebagai pajak yang akan Anda peroleh kreditnya. Laporan **TDS Receivable** mendaftarkannya agar bisa Anda cocokkan dengan sertifikat mereka.
- **Pembayaran tercatat salah**: **Reverse** dengan alasan. Tetap tampil di layar, dicoret, sebagai catatan.
- **Lihat semua pembayaran yang diterima**: **Payment History** (dari layar Penagihan), dapat dicari berdasarkan faktur, pelanggan, atau referensi.
- **Siapa yang berutang kepada saya?** **Pelanggan** menampilkan setiap saldo; **Laporan → Outstanding** mengelompokkan utang menurut umur (berjalan, 1 sampai 30 hari, 31 sampai 60, dan seterusnya). Ask Sarang juga bisa menjawab "Siapa yang berutang uang kepada saya?".

## 7. Saat barang kembali atau harga salah

- **Seluruh atau sebagian penjualan dikembalikan**: **Sales → Sales Returns** (aktifkan di **Pengaturan → Additional Business Features** jika tidak terlihat). Stok kembali ke rak dan saldo atau pengembalian dana pelanggan disesuaikan.
- **Uang yang harus dikembalikan tanpa retur stok** (kelebihan tagih, iktikad baik): **Sales → Nota Kredit → New**, dikaitkan dengan pelanggan dan faktur. Mengurangi utang pelanggan kepada Anda. Setiap nota memiliki **Add tax to this note**: biarkan aktif untuk mengembalikan pajaknya juga, atau matikan untuk jumlah polos.
- **Faktur dibuat karena salah**: buka dan **Cancel Invoice** (alasan wajib).

## 8. Pelanggan tetap dan pembayar terlambat

- **Profil Berulang** (grup Accounting) membuat faktur yang sama menurut jadwal, untuk sewa, langganan, dan retainer.
- **Daftar Harga** memberi kelompok pelanggan harga sendiri; **Skema Harga** menjalankan penawaran (beli 2 gratis 1, diskon 10 persen untuk satu kategori). Sarang menampilkan penawaran di keranjang; Anda yang memutuskan menerapkannya.
- **Bunga keterlambatan**: aktifkan di **Pengaturan → Business Features → Interest on overdue balances** dan atur tarif tahunan (sederhana atau majemuk bulanan). Tidak ada yang ditagih sendiri: di halaman pelanggan Anda melihat bunga yang dihasilkan tiap faktur terlambat dan menekan tombol untuk menagihnya.

## 9. Ikhtisar penjualan dan laporan

**Sales → Sales Overview** menampilkan penjualan dan faktur hari ini, utang pelanggan dan berapa yang terlambat, penawaran terbuka, dan pintasan ke setiap layar penjualan. **Laporan** memiliki penjualan per pelanggan, barang, kategori, dan tenaga penjual (pilih tenaga penjual di kasir), laba per barang dan pelanggan, register penjualan, piutang dan lainnya, masing-masing dengan grafik.

## Pertanyaan umum

**Bisakah saya menjual tanpa stok?** Sarang memblokir penjualan produk berstok ketika Inventaris tidak cukup ("Insufficient stock"). Terima dulu pembelian, atau sesuaikan stok dengan alasan. Jika kadang Anda harus menjual sebelum barang dicatat masuk, tanyakan kepada akuntan Anda, lalu aktifkan stok negatif di **Pengaturan → Business Features → Stock rules**.

**Di mana saya melihat penjualan hari ini?** **Dasbor**, atau **Laporan → Sales**.

**Mengapa pajak muncul di atas harga?** Secara bawaan Sarang menganggap setiap harga *sebelum pajak* dan menambahkan pajak di atasnya. Jika harga Anda sudah termasuk pajak, aktifkan **Prices include tax** (Pengaturan, atau sakelar pada dokumen). Lihat *Guide: Tax and GST*.

**Mengapa tidak ada pajak pada faktur ini?** Barang tidak memiliki tarif pajak, pelanggan ditandai bebas pajak, penjualan dicentang sebagai ekspor, atau usaha Anda berada di skema Composition.
