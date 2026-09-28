# Panduan: Pajak dan GST, Cara Sarang Menghitungnya

Sarang menghitung pajak dengan cara yang sama di setiap dokumen, dan menunjukkan angka yang sama kepada Anda di layar, pada dokumen yang disimpan, pada cetakan, di buku besar, dan di laporan. Panduan ini menjelaskan aturannya, cara mengaturnya, dan di mana melihat totalnya. Ini adalah panduan kerja untuk catatan Anda sendiri. Hukum pajak berubah dan tergantung situasi Anda, jadi pastikan tarif dan SPT Anda dengan akuntan Anda.

## Dua cara memasukkan harga

Setiap harga di Sarang (harga pokok, harga jual, biaya per satuan) adalah **sebelum pajak** atau **termasuk pajak**, dan setiap dokumen menyatakan yang mana.

- **Sebelum pajak (bawaan untuk India):** Sarang menambahkan pajak di atas.
- **Termasuk pajak:** harga yang Anda ketik sudah mengandung pajak, seperti pada label rak atau MRP. Sarang menghitung pajaknya secara terbalik.

Pilih cara Anda biasanya menetapkan harga di **Settings → Currency & Locale → Prices include tax**. Itu menjadi pilihan awal untuk setiap dokumen baru. Pada setiap dokumen (faktur, penawaran, pesanan penjualan, pesanan pembelian, tagihan pemasok, nota kredit, nota debit) ada saklar **Prices include tax**, dan kolom harga diberi label **(excl. tax)** atau **(incl. tax)**, jadi tidak pernah membingungkan. Membalik saklar mengonversi harga yang Anda masukkan agar pelanggan membayar jumlah yang sama. Di layar Billing saklar terkunci selama keranjang berisi barang, sehingga satu faktur tidak pernah mencampur kedua cara.

### Aritmatikanya

Sebelum pajak:

```
jumlah baris    = kuantitas x harga
nilai kena pajak = jumlah baris - diskon
pajak            = nilai kena pajak x tarif pajak
total baris      = nilai kena pajak + pajak
```

Contoh: 2 satuan seharga 500, diskon 100, pajak 18 persen. Jumlah baris 1.000. Nilai kena pajak 900. Pajak 162. Total 1.062.

Termasuk pajak:

```
jumlah baris    = kuantitas x harga          (sudah mengandung pajak)
setelah diskon    = jumlah baris - diskon
nilai kena pajak   = setelah diskon / (1 + tarif)
pajak              = setelah diskon - nilai kena pajak
```

Contoh: 1 satuan berharga 118 termasuk pajak 18 persen. Nilai kena pajak 100. Pajak 18. Total 118.

Dalam kedua cara, pajak dihitung dari nilai **setelah diskon**, diskon tingkat-dokumen dibagi secara adil ke seluruh baris, dan baris terakhir mengambil sisa recehan agar baris selalu menjumlahkan totalnya. Subtotal, diskon, pajak, dan total semuanya adalah satuan bulat mata uang Anda (paisa, sen, fils) tanpa desimal yang nyasar.

### Membulatkan total

**Settings → Currency & Locale → Invoice rounding** memilih cara total yang harus dibayar dibulatkan: **None**, **nearest 0.05**, **0.10**, **0.50**, atau **1**. Usaha dalam rupee India mulai pada "nearest 1"; mata uang lain mulai pada "None". Pembulatan ditampilkan sebagai barisnya sendiri pada faktur. Nota kredit dan nota debit tidak pernah dibulatkan dengan cara ini.

## Tetapkan tarif pajak sekali, pada produk

**Inventory → Produk →** produk itu **→ Tax Rate %**. Ketik sebuah tarif atau klik salah satu tarif tersimpan Anda. Tarif itu kemudian terisi pada faktur, penawaran, pesanan penjualan, pesanan pembelian, tagihan pemasok, dan nota debit saat Anda memilih produk. Anda tetap bisa mengubah tarif pada satu baris. Jika tarif yang Anda ketik bukan salah satu tarif tersimpan Anda, Sarang menampilkan peringatan halus agar kesalahan ketik seperti 81 alih-alih 18 tertangkap.

Pilih juga **Tax category** produk: **Standard**, **Reduced**, **Zero-rated**, **Exempt**, **Nil-rated**, atau **Out of scope**. Kategori ini diingat pada setiap baris dokumen dan menentukan Tax Report serta baris GSTR-1 untuk pasokan nil-rated, exempt, dan non-GST. Baris yang benar-benar mengenakan pajak tidak pernah bisa dilaporkan sebagai exempt atau nil-rated.

## Tarif GST di India

Tarif GST berubah pada 22 September 2025. Tarif yang berlaku sekarang adalah **5 persen**, **18 persen**, dan **40 persen** (daftar pendek barang mewah dan "dosa"), plus **nil**, dengan tarif khusus **3 persen** (emas, perak, perhiasan) dan **0,25 persen** (berlian mentah). Tarif 12 dan 28 persen ditarik. Sarang menawarkan ini sebagai tarif tersimpan dan menjaga tarif lama Anda 12 dan 28 persen tetap terlihat di bawah **Older rates (before 22 Sep 2025)** di **Settings → Tax Configuration**, agar catatan lama tetap masuk akal. Tarif mana yang berlaku untuk suatu barang tergantung kode HSN-nya: tanyakan akuntan Anda dan tetapkan pada produk. Dokumen lama menyimpan tarif saat dibuat; mengubah tarif produk tidak pernah mengubah dokumen lampau.

## Cara pajak ditampilkan: CGST + SGST, IGST, atau GST

Untuk usaha ber-GST, setiap dokumen pajak memiliki pilihan **Tax shown as**:

| Pilihan | Gunakan saat | Yang dicetak |
|---|---|---|
| **CGST + SGST** | Pembeli berada di negara bagian yang sama | Dua baris sama (untuk 18 persen, 9 plus 9) |
| **IGST** | Pembeli berada di negara bagian lain | Satu baris IGST |
| **GST** | Anda ingin satu baris gabungan | Satu baris bernama GST |

Sarang memilih untuk Anda dengan membandingkan negara bagian usaha Anda dengan negara bagian pelanggan (atau, pada pembelian, pemasok), dan Anda dapat mengubahnya pada dokumen. Jika pelanggan tidak memiliki negara bagian tersimpan tetapi memiliki GSTIN, dua digit pertama GSTIN (kode negara bagian) digunakan. Jika tidak keduanya diketahui, Sarang menggunakan CGST + SGST.

**Jumlah pajak dan total persis sama di ketiga pilihan.** Hanya cara jumlah yang sama ditampilkan yang berubah. Saat suatu jumlah tidak terbagi rata, kedua bagian berbeda paling banyak satu paisa dan selalu menjumlahkan kembali ke pajak penuh. Dalam laporan, dokumen yang ditampilkan sebagai satu baris GST diklasifikasikan sebagai CGST + SGST atau IGST berdasarkan tempat pasokannya, dan laporan memperingatkan berapa banyak dokumen yang tidak memiliki negara bagian.

## Nota kredit dan nota debit: tambah pajak atau lewati

Setiap nota kredit dan nota debit memiliki **Add tax to this note**. Ini mulai aktif saat faktur, pesanan pembelian, atau tagihan yang tertaut membawa pajak, dan tidak aktif jika sebaliknya; Anda dapat mengubahnya.

- **Lewati pajak:** total nota sama dengan jumlahnya; tidak ada baris pajak dicetak; saldo pelanggan atau pemasok bergerak hanya sebesar jumlah itu.
- **Tambah pajak:** nota yang dibuat dari barang menggunakan tarif pajak setiap baris; nota jumlah-polos meminta tarif pajak dan memperlakukan jumlah tersebut sebagai sebelum-pajak atau termasuk-pajak sesuai pengaturan harga nota itu sendiri. Pajak ditampilkan sebagai CGST + SGST, IGST, atau GST seperti dokumen lainnya.

Jika Anda melewati pajak pada nota yang tertaut ke dokumen yang mengenakan pajak, Sarang memperingatkan bahwa pajak yang Anda kenakan sebelumnya tidak akan dibalik; Anda tetap bisa melanjutkan. Tax Report, GSTR-1, dan GSTR-3B menyertakan pajak nota hanya saat ditambahkan.

## Kasus khusus

| Situasi | Apa yang harus dilakukan |
|---|---|
| Pelanggan bebas pajak | Tandai pelanggan sebagai bebas pajak di halamannya dan masukkan nomor sertifikat pembebasan serta tanggal berlakunya. Faktur mereka tidak membawa pajak selama sertifikat berlaku; setelah tanggal itu Sarang mengenakan pajak lagi dan formulir pelanggan menampilkan peringatan |
| Penjualan ke pelanggan di negara lain (ekspor) | Di layar Billing centang **Export sale?** (muncul saat negara pelanggan berbeda dari Anda). Penjualan kemudian menjadi zero-rated. Sarang tidak pernah melakukan ini sendiri; periksa aturan ekspor dan simpan bukti ekspor |
| Usaha Anda berada di bawah Composition Scheme | **Settings → Business Profile → GST Scheme → Composition Scheme.** Penjualan kemudian diterbitkan sebagai Bill of Supply tanpa pajak terpisah |
| Pembelian di mana **Anda** membayar pajak (reverse charge) | Centang **Reverse Charge** pada tagihan pemasok atau pengeluaran. Pajak dicatat sebagai kewajiban Anda sendiri, bukan bagian dari yang Anda utang ke pemasok |
| Pelanggan atau pemasok luar negeri | Gunakan opsi mata uang asing pada dokumen; jumlah mempertahankan desimal mata uang Anda sendiri |
| Sampel gratis atau barang skema | Gunakan **Give free** pada baris, atau biarkan skema harga menambahkan baris seperti "beli 2 dapat 1 gratis". Stok keluar; harga dan pajak nol |
| Pengiriman, pengemasan, atau biaya lain | **Add Charge** di layar Billing, dengan tarif pajak yang berlaku untuk biaya itu |
| Pelanggan menahan pajak penghasilan (TDS) saat membayar | Catat di jendela pembayaran faktur sebagai **TDS deducted**. Ini bukan uang yang diterima; ini pajak yang akan Anda klaim kreditnya (**Reports → TDS Receivable**) |

## Di mana Anda melihat total pajak

- **Reports → Tax Report:** pajak yang dipungut pada penjualan, per tarif, dan per kategori pajak.
- **Reports → GSTR-1:** penjualan untuk SPT, business-to-business per faktur dan tarif, business-to-consumer per tarif dan negara bagian, baris nil-rated, exempt, dan non-GST, serta baris nota kredit dan debit.
- **Reports → GSTR-3B Preview:** pasokan keluar (termasuk zero-rated) dan pembelian reverse-charge bulan itu. Ini pratinjau untuk dibandingkan dengan yang ditampilkan portal; pengajuan dilakukan di portal pemerintah.
- **Reports → HSN Summary:** penjualan per kode HSN (baris penawaran membawa kode HSN hingga ke faktur).
- **Reports → Purchase GST Register** dan **Purchase HSN Summary:** hal yang sama untuk pembelian (tagihan, pesanan pembelian yang diterima, dan nota debit).
- **Reports → GST Net Payable & Input Credit:** pajak yang Anda pungut, kredit pajak masukan dari pembelian Anda, dan yang tersisa untuk dibayar atau dibawa maju, per CGST, SGST, dan IGST.
- **Reports → GSTR-9 Annual Data:** kertas kerja angka tahun itu untuk SPT tahunan Anda.
- **Reports → TDS Deducted:** pajak yang Anda potong dari pemasok, per bagian, dan berapa yang masih harus disetor.
- **Reports → TDS Receivable:** pajak yang ditahan pelanggan Anda.
- Pada setiap faktur cetak: baris pajak untuk presentasi yang dipilih dan, jika berlaku, catatan "Prices include tax".

## Pajak atas pembelian dan kredit pajak masukan

Tagihan pemasok, pesanan pembelian, dan nota debit menghitung pajak dengan cara yang sama. Biaya stok tidak pernah menyertakan pajak pembelian: untuk tagihan atau pesanan pembelian berharga termasuk pajak, Sarang menggunakan biaya sebelum pajak untuk nilai inventaris dan biaya rata-rata.

Untuk usaha ber-GST pada skema reguler, pajak pada setiap tagihan pemasok, pesanan pembelian yang diterima, dan nota debit dicatat sebagai **input tax credit** dalam akunnya sendiri. **GST Net Payable & Input Credit** menunjukkan apa yang Anda pungut, kredit yang Anda miliki, dan selisihnya. Kredit hanya dicatat untuk dokumen yang dibuat mulai sekarang; pembelian sebelumnya tidak dihitung, dan laporan menyatakan hal itu. Laporan juga tidak menentukan urutan kredit dikompensasikan terhadap setiap pos: akuntan Anda yang memutuskan itu.

**Accounting → GST Payments** (India) mencatat pembayaran yang Anda lakukan ke pemerintah: mengurangi pajak yang Anda utang dan kredit yang Anda gunakan, serta mengurangi bank atau kas Anda. Periksa jumlahnya dengan akuntan Anda sebelum membayar.

**Accounting → GST Return Files** (India) menyiapkan **GSTR-1** dan **GSTR-3B** sebagai berkas JSON yang dapat Anda unggah sendiri di portal pemerintah atau buka di alat offline-nya: pilih bulan, siapkan berkas, dan simpan. Pada halaman sendiri suatu faktur, kartu **e-invoice** dan **e-way bill** menyiapkan berkas permintaan untuk faktur itu, dan setelah Anda unggah secara manual Anda mengetik IRN yang dikembalikan agar tercetak dengan kode QR-nya (**Reports → E-invoice IRN Register** mendaftarkannya). Semua ini adalah draf dari catatan Anda. Tata letak berkas-berkas ini mengikuti format offline portal sejauh yang kami pahami, jadi buka masing-masing di alat resmi pemerintah dan perbaiki apa pun yang dikeluhkannya sebelum Anda mengandalkannya. Tidak ada yang dikirim ke pemerintah dari Sarang.

**Mencocokkan pembelian Anda dengan portal:** unduh GSTR-2B (atau 2A) JSON Anda dari portal dan pilih di **GST Return Files**. Sarang mencocokkannya dengan tagihan pemasok Anda berdasarkan GSTIN pemasok, nomor faktur, dan tanggal, lalu mendaftarkan apa yang cocok, apa yang berbeda, apa yang hilang di catatan Anda, dan apa yang hilang di portal. Ketik nomor dan tanggal faktur milik setiap pemasok sendiri pada tagihan agar pencocokan berfungsi.

## Kesalahan umum

| Kesalahan | Hasil | Perbaikan |
|---|---|---|
| Memasukkan harga termasuk pajak pada dokumen sebelum-pajak | Pajak ditambahkan di atas harga yang sudah memilikinya | Aktifkan **Prices include tax** untuk dokumen itu, atau masukkan harga sebelum pajak |
| Lupa menetapkan tarif pajak pada produk baru | Dokumen tidak menampilkan pajak | Tetapkan pada produk |
| Menggunakan tarif yang salah untuk suatu barang | Pajak salah pada setiap penjualan | Pastikan HSN dan tarif dengan akuntan Anda dan perbaiki produk |
| Memilih IGST untuk penjualan dalam negara bagian yang sama | Satu baris IGST alih-alih CGST dan SGST | Ubah **Tax shown as** pada dokumen sebelum menyimpan, atau batalkan dan terbitkan ulang, atau gunakan Nota Kredit |
| Melewati pajak pada nota kredit untuk faktur yang dikenai pajak | Pajak yang Anda kenakan tetap ada di pembukuan | Aktifkan kembali **Add tax to this note** |
