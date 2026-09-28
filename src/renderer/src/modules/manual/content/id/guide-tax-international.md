# Panduan: Pajak di Luar India (PPN, Pajak Penjualan, dan Lainnya)

Sarang bekerja untuk usaha di negara mana pun. Panduan ini menjelaskan bagaimana pajak bekerja ketika usaha Anda tidak berada pada GST India, dan cara mengaturnya. Aturan pajak berbeda menurut negara dan berubah, jadi pastikan tarif, format nomor pajak, dan SPT Anda dengan akuntan lokal atau otoritas pajak Anda. Sarang menyimpan tarif yang Anda gunakan; tidak menentukannya untuk Anda.

## Aturan negara hanya berlaku untuk negara Anda

Sarang memuat tarif pajak dan label **hanya untuk negara yang Anda pilih sebagai negara usaha Anda**. Jika usaha Anda di Jerman, Anda melihat tarif dan istilah Jerman dan tidak ada dari negara lain mana pun. India bekerja persis seperti biasanya kecuali Anda memilih negara lain. Anda memilih negara saat pengaturan pertama, atau nanti di **Settings → Business Profile**.

**Bahasa.** Layar Sarang tersedia dalam 13 bahasa (Inggris, Hindi, Marathi, Gujarati, Kannada, Tamil, Telugu, Malayalam, Spanyol, Prancis, Portugis, Arab, dan Indonesia). Untuk negara yang bahasanya bukan salah satu dari ini, nama dan catatan pajak negara itu ditampilkan dalam **bahasa Inggris**, apa pun bahasa layar lainnya.

## Langkah 1: pilih negara Anda

Saat pengaturan, pilih negara Anda dari daftar (Anda tetap bisa mengetik yang tidak terdaftar). Sarang mengenali sekitar 50 negara dan, untuk masing-masing, menyarankan model pajak, mata uang, label nomor pajak, tarif standar, apakah harga rak biasanya termasuk pajak, dan pembulatan tunai yang lazim di sana. Anda memastikan setiap saran; tidak ada yang diterapkan secara diam-diam.

Negara dengan tarif bawaan (per 25 September 2026): India, Britania Raya, Irlandia, Jerman, Prancis, Italia, Spanyol, Belanda, Portugal, Belgia, Austria, Polandia, Swedia, Denmark, Swiss, Uni Emirat Arab, Arab Saudi, Oman, Bahrain, Qatar, Kuwait, Mesir, Turki, Israel, Australia, Selandia Baru, Singapura, Malaysia, Thailand, Indonesia, Filipina, Vietnam, Jepang, Korea Selatan, Tiongkok, Hong Kong, Pakistan, Bangladesh, Sri Lanka, Nepal, Afrika Selatan, Kenya, Nigeria, Ghana, Kanada, Amerika Serikat, Meksiko, Argentina, Chili, dan Kolombia. Qatar, Kuwait, dan Hong Kong tidak memiliki PPN atau pajak penjualan, jadi mereka mulai tanpa pajak. Amerika Serikat tidak memiliki pajak penjualan nasional dan tarif negara bagiannya bervariasi, jadi Anda menambahkan sendiri. Brasil memiliki beberapa pajak dalam satu penjualan dan tidak disertakan: tambahkan tarif Anda secara manual. **Tarif berubah**, dan daftar menunjukkan tanggal terakhir diperiksa; selalu pastikan dengan otoritas pajak Anda.

Jika negara Anda tidak ada dalam daftar, daftar tarif pajak dimulai dengan satu baris "No tax" dan catatan yang meminta Anda menambahkan tarif secara manual.

## Langkah 2: periksa model pajak dan tarif Anda

| Model pajak | Digunakan untuk | Yang dicetak |
|---|---|---|
| **GST** | India | CGST dan SGST, atau IGST, atau satu baris GST, dengan GSTIN Anda |
| **VAT** | Negara dengan pajak pertambahan nilai atau pajak bergaya GST (Britania Raya, UE, Teluk, Australia, Selandia Baru, Singapura, Kanada, dan lainnya). Baris menggunakan nama pajak sendiri milik negara Anda, misalnya GST di Australia | Satu baris dengan nama pajak Anda |
| **Sales Tax** | Amerika Serikat dan negara pajak-penjualan lainnya | Satu baris bernama **Sales Tax** |
| **Custom** | Pajak lain apa pun dengan namanya sendiri | Satu baris bernama **Tax** |
| **None** | Tidak ada pajak dikenakan | Tidak ada baris pajak |

Buka **Settings → Tax Configuration**. Ini mendaftar tarif yang Anda pungut. Jika negara usaha Anda memiliki tarif bawaan, tombol **Load tax rates for {your country}** menambahkan yang hilang (tidak pernah menghapus atau mengubah yang sudah Anda miliki, dan tidak pernah mengubah dokumen lampau). Layar menunjukkan tanggal terakhir tarif diperiksa dan catatan apa pun, misalnya di mana suatu negara memiliki tarif provinsi atau negara bagian tambahan. Tandai tarif biasa Anda sebagai bawaan, dan tambahkan yang hilang. Kemudian tetapkan tarif yang benar pada setiap produk (Products → Tax Rate %) atau pilih dari tarif tersimpan Anda. Sarang memperingatkan Anda dengan halus jika tarif yang Anda ketik bukan salah satu tarif tersimpan Anda.

Pilih **Tax category** setiap produk: standard, reduced, zero-rated, exempt, nil-rated, atau out of scope. Barang **zero-rated** (dikenakan pada 0 persen tetapi tetap dapat dilaporkan) berbeda dari yang **exempt**. Pelanggan yang bebas pajak dapat ditandai bebas pajak di halamannya, dengan nomor sertifikat pembebasan atau penjualan kembali serta tanggal berlakunya; faktur mereka tidak membawa pajak selama sertifikat berlaku, dan pajak dikenakan lagi setelah tanggal itu (formulir pelanggan memperingatkan Anda).

### Membagi tarif menjadi bagian

Di mana satu penjualan membawa dua pajak (GST federal Kanada ditambah PST provinsi, atau pajak penjualan negara bagian ditambah county di AS), masukkan **tarif gabungan** sebagai satu tarif, lalu di formulir tarif gunakan **Add part** untuk menamai bagian-bagiannya, misalnya GST 5 dan PST 7 untuk tarif 12 persen. Bagian-bagian harus berjumlah sama dengan tarif. Jumlah yang dipungut tidak berubah; faktur, penawaran, tagihan, dan pesanan pembelian kemudian menunjukkan setiap bagian pada barisnya sendiri, dan **Reports → Tax by Part** menjumlahkan pajak pada penjualan dan pembelian untuk setiap bagian, sehingga masing-masing dapat dilaporkan ke otoritasnya sendiri. Pajak yang dikenakan di atas pajak lain (pajak atas pajak) tidak dimodelkan: masukkan tarif gabungan efektif sebagai gantinya.

## Langkah 3: harga dengan atau tanpa pajak

Toko di banyak negara menampilkan harga rak yang sudah termasuk pajak. Saat pengaturan, Sarang menyarankan apakah harga di negara Anda biasanya termasuk pajak, dan Anda memastikannya. Anda dapat mengubahnya kapan saja di **Settings → Currency & Locale → Prices include tax**, dan pada setiap dokumen ada saklar **Prices include tax** dengan kolom harga berlabel **(incl. tax)** atau **(excl. tax)**.

Sebelum pajak, pajak ditambahkan di atas:

```
nilai kena pajak = kuantitas x harga - diskon
pajak             = nilai kena pajak x tarif
total             = nilai kena pajak + pajak
```

Contoh: 3 barang seharga 10,00, diskon 10 persen, PPN 20 persen. Baris 30,00, kena pajak 27,00, PPN 5,40, total 32,40.

Termasuk pajak, pajak diambil dari harga yang Anda ketik: harga 12,00 termasuk PPN 20 persen memberikan kena pajak 10,00, PPN 2,00, total 12,00. Total selalu merupakan harga yang dilihat pelanggan.

Jumlah mempertahankan desimal persis yang digunakan mata uang Anda (dua untuk dolar, pound, euro, dan dirham; tiga untuk dinar; tidak ada untuk yen).

## Langkah 4: pembulatan tunai

**Settings → Currency & Locale → Invoice rounding** menawarkan None, nearest 0.05, 0.10, 0.50, atau 1. Banyak negara membulatkan total tunai (misalnya ke 0,05 di Swiss, Australia, dan Selandia Baru). Saat pengaturan, Sarang menyarankan aturan biasa negara Anda dan Anda memastikannya. Pembulatan ditampilkan sebagai barisnya sendiri pada faktur.

## Langkah 5: nomor pajak

Masukkan **nomor pajak** Anda di **Settings → Business Profile**; ini tercetak pada faktur. Kolom ini mengambil nama yang digunakan negara Anda (VAT number, TRN, ABN, EIN, GST number, dan sebagainya). Pelanggan dan pemasok memiliki kolom yang sama. Di mana Sarang yakin akan format nomor suatu negara, ia menampilkan petunjuk halus jika nomor tampak salah; tidak pernah menghalangi Anda menyimpan. Sarang hanya memeriksa format ketat GSTIN, PAN, dan IFSC India.

## Menjual ke negara lain

- **Mata uang asing:** pada dokumen penjualan centang opsi mata uang asing dan masukkan kode mata uang. Jika Anda menyimpan tabel kurs di **Settings → Business Features → Exchange rates** (ketik atau impor CSV dengan kolom mata uang, kurs, tanggal), kurs terbaru terisi untuk Anda; Anda selalu dapat mengubahnya. Sarang menunjukkan jumlah yang dikonversi dan menjaga pembukuan Anda dalam mata uang Anda sendiri. Saat pelanggan membayar, **Settle in {currency}** mencatat laba atau rugi selisih kurs.
- **Pajak atas ekspor:** banyak negara menetapkan ekspor sebagai zero-rate. Saat negara pelanggan berbeda dari Anda, layar Billing menampilkan **Export sale?**: centang dan penjualan menjadi zero-rated, dengan catatan "Export supply, zero-rated" pada faktur. Sarang tidak pernah melakukan ini sendiri. Tanyakan akuntan Anda penjualan mana yang memenuhi syarat dan simpan bukti ekspor Anda.
- **Pemasok di luar negeri:** catat **Supplier Bill** dalam mata uang asing dengan cara yang sama. Jika Anda harus memperhitungkan sendiri pajak pada impor atau jasa dari luar negeri (reverse charge), centang **Reverse Charge** pada tagihan.

## Nota kredit dan nota debit

Masing-masing memiliki **Add tax to this note**: lewati dan total nota hanya jumlahnya saja; tambahkan dan pajak dihitung pada nota seperti dokumen mana pun. Lihat *Panduan: Pajak dan GST, Cara Sarang Menghitungnya* untuk rinciannya.

## Laporan yang dapat Anda gunakan untuk SPT Anda

- **Reports → VAT / Sales Tax Return:** kertas kerja yang disusun menurut kotak SPT negara Anda untuk Britania Raya, Australia, Selandia Baru, Kanada, Singapura, Uni Emirat Arab, Arab Saudi, dan Afrika Selatan, serta ringkasan umum (penjualan dan pembelian berdasarkan perlakuan pajak) untuk setiap negara lainnya. Kotak yang tidak dapat diisi Sarang dari catatan Anda dibiarkan nol dan diberi label dalam bahasa Inggris. Periksa setiap kotak terhadap formulir otoritas pajak Anda sebelum mengajukan.
- **Reports → Tax Report:** pajak yang dipungut pada penjualan, per tarif dan per kategori pajak, untuk rentang tanggal mana pun. Berfungsi untuk setiap model pajak.
- **Reports → Tax by Part:** pajak pada penjualan dan pembelian untuk setiap bagian bernama dari suatu tarif.
- **Reports → Purchase Register:** apa yang Anda beli, dengan pajak pada setiap tagihan, sehingga akuntan Anda dapat menghitung pajak yang dapat Anda klaim kembali.
- **Reports → TDS Deducted** dan **TDS Receivable:** pajak yang Anda tahan dari pemasok, dan pajak yang ditahan pelanggan Anda dari Anda. Layar menyebutnya TDS; gunakan juga untuk pajak potong di negara Anda, dan pastikan aturannya dengan penasihat pajak Anda.
- **Reports → Profit and Loss**, **Balance Sheet**, **Trial Balance**, dan **Cash Book** untuk periode itu.

## Batasan yang perlu diketahui hari ini

- Satu tarif pajak per baris. Dua pajak pada satu penjualan ditangani dengan membagi tarif gabungan menjadi bagian-bagian (di atas); jumlah yang dipungut selalu merupakan tarif gabungan.
- Sarang tidak memilih tarif berdasarkan negara bagian, county, atau kota pelanggan. Tambahkan tarif gabungan yang Anda perlukan (misalnya satu per negara bagian tempat Anda menjual) dan pilih yang benar pada produk atau baris.
- Item khusus India (GST return files, e-way bill, HSN, PF, dan ESI) disembunyikan untuk negara lain.
- Pengiriman e-invoicing pemerintah dan pengajuan online tidak disertakan; Sarang bekerja offline dan tidak pernah mengirim apa pun ke otoritas pajak.
