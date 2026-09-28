# Panduan: Membeli dari Pemasok, dari Pesanan sampai Pembayaran

Siklus pembelian lengkap, beserta dampak tiap langkah pada stok dan uang Anda. Baca tabelnya dulu: ini mencegah kebingungan yang paling sering terjadi.

```
Pesanan Pembelian  ->  Terima Stok / GRN  ->  Tagihan Pemasok  ->  Pembayaran Pemasok  ->  (Nota Debit)
 yang Anda pesan        barang tiba           yang Anda utang     yang Anda bayar         barang dikembalikan
 tanpa stok, tanpa uang STOK naik             UTANG naik          utang turun
```

| Langkah | Mengubah stok? | Mengubah utang Anda? |
|---|---|---|
| Pesanan Pembelian | Tidak | Tidak |
| Terima Stok (di PO) atau GRN terkait | **Ya** | Ya (saat diterima) |
| Tagihan Pemasok | **Tidak** | **Ya** |
| Pembayaran Pemasok | Tidak | Ya (turun) |
| Nota Debit | Hanya jika barang dikembalikan | Ya (turun) |

**Tagihan Pemasok tidak pernah mengubah stok.** Ia hanya mencatat uang. Stok bertambah hanya saat Anda menerima barang.

## 1. Tambahkan pemasok (sekali)

**Pembelian → Pemasok → Add Supplier.** Isi nama, telepon, alamat, GSTIN dan PAN jika ada, data bank untuk membayarnya, dan **saldo awal** jika Anda sudah berutang kepadanya.

Sarang mencegah Anda membuat pemasok yang sama dua kali. Pemasok tidak akan disimpan bila sudah ada (aktif atau diarsipkan) yang memiliki:

- **nomor telepon** yang sama,
- **GSTIN** yang sama,
- **email** yang sama,
- **nama yang sama di kota yang sama** (jika kota dikosongkan, nama yang sama sudah dihitung).

Jika yang cocok adalah pemasok yang diarsipkan, Sarang meminta Anda memulihkannya, bukan membuat yang baru. Format GSTIN, PAN, dan IFSC diperiksa (misalnya GSTIN terdiri dari 15 karakter seperti *29ABCDE1234F1Z5*) dan disimpan dalam huruf kapital. Jika dua pemasok berbeda punya nama sama, tambahkan kota masing-masing untuk membedakan. **Find duplicates** di layar Pemasok mendaftar catatan yang tampak seperti pemasok yang sama dan memungkinkan Anda **menggabungkannya** (penggabungan memindahkan semua tagihan dan pembayaran ke catatan yang Anda pertahankan dan tidak bisa dibatalkan).

Berguna juga pada pemasok: **kontak person**, **kategori** dan **peringkat** untuk keperluan Anda, **termin pembayaran** dalam hari (tagihan baru lalu mendapat jatuh tempo otomatis), dan **batas kredit** (pengingat seberapa banyak Anda bersedia berutang; ditampilkan, tidak memblokir tagihan). **Saldo awal** bisa negatif bila Anda sudah membayar pemasok di muka. Seperti pelanggan, pemasok bisa punya **alamat lain** di halamannya.

## 2. Pastikan produknya ada

Setiap barang yang dibeli untuk dijual kembali harus lebih dulu menjadi **Produk** (**Inventaris → Produk**), lengkap dengan **harga pokok** dan **tarif pajak**. Jika barang baru, buat sekarang. Anda juga bisa membuatnya dari layar barang diterima (langkah 4). Pajak pembelian tidak pernah menjadi bagian dari biaya stok: biaya stok selalu harga sebelum pajak.

Membeli sesuatu yang bukan stok jual kembali (sewa, perbaikan, jasa profesional, peralatan)? Lewati produk: catat sebagai baris **Jasa** di Tagihan Pemasok atau sebagai **Biaya**.

## 3. Memesan: Pesanan Pembelian (opsional tetapi disarankan)

**Pembelian → Pesanan Pembelian → New PO.** Pilih pemasok (atau **+ Add New Supplier**), tambahkan barang dengan jumlah dan biaya, serta tanggal yang diharapkan. Saat memilih produk, harga pokok **dan tarif pajaknya** terisi otomatis; keduanya bisa diubah.

PO bergerak **Draft → Approved → Received**. Jika ada aturan persetujuan, PO masuk ke penyetuju dulu. Anda bisa mencetak PO atau mengirimnya ke pemasok lewat WhatsApp atau Email. Stok menipis? Di layar **Inventaris**, **Generate Reorder POs** membuat pesanan pembelian draf untuk semua yang di bawah batas pemesanan ulang, memakai pemasok bawaan tiap produk.

## 4. Barang tiba: terima

Ada dua cara. Pakai yang sesuai dengan bisnis Anda.

**A. Receive Stock pada Pesanan Pembelian** (paling sederhana). Buka PO yang disetujui dan klik **Receive Stock**. Stok naik, biaya rata-rata diperbarui, dan pembukuan Anda mencatat pembelian.

**B. GRN (Goods Received Note, catatan penerimaan barang)** (bila pengiriman datang bertahap, atau Anda ingin mencatat jumlah rusak atau ditolak). **Pembelian → GRN → New GRN**: pilih pemasok, kaitkan PO bila perlu, dan isi tiap barang dengan jumlah diterima dan ditolak serta biayanya.

**Penting pada GRN: hubungkan setiap baris ke produk.** Setiap baris punya daftar pilihan produk.

- Dipilih dari daftar: baris menambah stok produk itu saat GRN **Posted**.
- Dibiarkan **Not in catalog**: baris hanya catatan di atas kertas. Muncul label kecil *unlinked* dan **tidak** mengubah Inventaris atau Produk.
- Barang belum ada di daftar? Ketik namanya dan klik **+ Create product "…" and link**. Sarang membuat produk dengan harga pokok Anda dan menghubungkan barisnya. Tetapkan **harga jual** sebenarnya di Produk sebelum menjualnya.
- Saat mengklik **Post** pada GRN yang punya baris tak terhubung, Sarang memperingatkan berapa banyak yang tidak akan memperbarui stok. Batalkan dan hubungkan, atau posting saja.
- GRN yang sudah diposting tidak bisa diubah. Jika ada baris yang terposting tanpa hubungan karena salah, lakukan **Reverse** pada GRN dan masukkan lagi dengan produk terhubung.

GRN disimpan sebagai Draft, lalu Verified, lalu **Posted** (stok berubah hanya saat Posted).

**Baris terposting tanpa hubungan dan GRN tidak bisa di-reverse?** Pada GRN yang sudah diposting, baris tak terhubung punya **Link to an item**. Pilih produknya dan jumlahnya ditambahkan ke stok. Ini hanya menghubungkan penerimaan; tidak mengubah jumlah diterima pada pesanan pembelian atau detail batch, jadi periksa sendiri.

**Mana yang harus saya pakai?** Layar Pesanan Pembelian dan GRN menampilkan petunjuk singkat tentang cara penerimaan yang sedang Anda pakai. Gunakan satu cara untuk satu pengiriman, jangan keduanya: menerima di PO lalu memposting GRN untuk barang yang sama menambah stok dua kali.

## 5. Catat yang ditagihkan pemasok: Tagihan Pemasok

**Pembelian → Tagihan Pemasok → Record Bill.**

1. Pilih pemasok (atau tambahkan).
2. Tetapkan **tanggal tagihan** dan **jatuh tempo**. Jatuh tempo menentukan daftar Terlambat. Jika pemasok punya termin pembayaran, jatuh tempo terisi sendiri. Ketik **nomor dan tanggal faktur milik pemasok** persis seperti di tagihan kertasnya: Sarang memperingatkan bila nomor faktur pemasok yang sama dimasukkan dua kali, dan bisnis GST membutuhkannya untuk mencocokkan pembelian dengan portal pemerintah.
3. Tambahkan baris. Baris adalah **Produk** (biaya dan pajak terisi dari produk) atau **Jasa** (teks bebas, dengan kategori, untuk yang bukan stok).
4. Masukkan **diskon** dan **tarif pajak** tiap baris agar total sama dengan tagihan kertas pemasok. Cocokkan total dengan kertas.
5. Centang **Reverse Charge** hanya jika akuntan Anda mengatakan pajak pembelian ini dibayar oleh Anda, bukan pemasok.
6. Opsional tambahkan **biaya pendaratan (landed costs)** (ongkos kirim, bea, penanganan); dibagi ke seluruh barang dan menaikkan biaya sebenarnya.
7. **Simpan.** Tagihan mendapat nomor (misalnya BILL-00012) dan status **Open**. Utang Anda ke pemasok itu naik. Untuk bisnis GST, pajak pada tagihan dicatat sebagai **kredit pajak masukan** (kecuali Anda memakai skema Composition), dan nota debit menguranginya lagi.

**Salah input?** Selama tagihan **Open** dan **belum ada pembayaran** tercatat, buka dan klik **Edit bill**. Ubah yang perlu lalu simpan. Sarang mengganti tagihan dengan nomor yang sama, membalik jurnal lama dan memposting yang benar dalam satu langkah, dan menyimpan salinan lama sebagai *BILL-00012-R1 (Void)* agar riwayat lengkap. Jika sudah ada pembayaran, batalkan pembayarannya dulu. Untuk membatalkan tagihan seluruhnya, gunakan **Void** (alasan wajib).

**Status tagihan:** Open, Partially Paid, Paid, Void. Daftar juga punya filter **Overdue** dan lencana **OVERDUE** pada tagihan terbuka atau terbayar sebagian yang jatuh temponya sudah lewat.

## 6. Bayar pemasok: Pembayaran Pemasok

Buka tagihan dan klik **Record Payment**: jumlah (sebagian atau penuh), metode (Cash, UPI, Card, Bank Transfer, Cheque), referensi. Tagihan menjadi **Partially Paid** atau **Paid** dan utang Anda turun. **Pembelian → Pembayaran Pemasok** mendaftar semua pembayaran yang Anda lakukan dan memungkinkan membatalkan yang salah. Membayar beberapa tagihan ke satu pemasok sekaligus? Pakai opsi pembayaran massal di sana.

Jika Anda memotong **TDS** saat membayar profesional atau kontraktor, Sarang menyarankan jumlah untuk bagian yang Anda pilih. Anggap hanya sebagai saran: konfirmasikan bagian dan tarifnya dengan akuntan Anda, karena aturan berubah pada 2026. **Reports → TDS Deducted** mendaftar yang Anda potong, per bagian, dan berapa yang masih harus disetor. Di formulir pembayaran, **Ctrl + Enter** menyimpan.

## 7. Kembalikan barang atau koreksi tagihan: Nota Debit

**Pembelian → Nota Debit → New.** Kaitkan dengan pemasok (dan PO atau tagihan). Ini mengurangi utang Anda. Centang **Itemize** untuk mendaftar barang yang dikembalikan beserta pajaknya. Nota debit adalah retur pembelian Anda: pasangan dari sisi pemasok untuk Retur Penjualan dan Nota Kredit.

## 8. Lihat posisi Anda

- **Pembelian → Ikhtisar Pembelian**: yang Anda utang, yang jatuh tempo dalam 7 hari ke depan, tagihan terbuka, dan daftar tagihan yang harus dibayar minggu ini.
- **Pemasok**: halaman tiap pemasok menampilkan saldo utang serta setiap tagihan dan pembayaran; tombol **Statement** membuka akunnya untuk dicetak atau dikirim.
- **Reports → Purchase Register, Purchases by Vendor, Purchases by Item, AP Aging Summary**: yang Anda beli dan yang Anda utang, menurut seberapa terlambat.
- **Reports → Payables / Supplier Ledger**: akun lengkap seorang pemasok.
- **Reports → Purchase GST Register, Purchase HSN Summary, GST Net Payable & Input Credit** (bisnis GST): pembelian beserta pajaknya, pembelian menurut kode HSN, dan pajak yang bisa Anda klaim terhadap pajak yang Anda tagihkan. Lihat *Guide: Tax and GST*.
- Ask Sarang: "Saya berutang ke siapa?", "Tagihan pemasok mana yang terlambat?", "Tagihan jatuh tempo minggu ini".

## Contoh nyata

Anda membeli 50 bohlam LED seharga 40 rupee, ditambah pajak 18 persen, dengan kredit 30 hari, dan membayar dua kali.

1. **Produk**: buat *LED Bulb 9W*, biaya 40, pajak 18.
2. **Pesanan Pembelian**: pemasok *Amba Agencies*, 50 unit. Setujui.
3. **Receive Stock**: 50 bohlam tiba; Inventaris kini menunjukkan 50.
4. **Tagihan Pemasok**: tanggal hari ini, jatuh tempo 30 hari; baris terisi 50 x 40 dengan pajak 18 persen; total 2,360. Status Open, Anda berutang 2,360.
5. **Pembayaran Pemasok**: 1,000 lewat UPI (Partially Paid, utang 1,360), lalu 1,360 lewat transfer bank (Paid).
6. Sepuluh bohlam rusak: **Nota Debit** untuk 10 x 40 plus pajak, dan kirim kembali.
