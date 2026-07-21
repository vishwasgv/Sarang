# Jewellery

## Apa yang berbeda dari jenis bisnis ini

Harga jual sebenarnya dari sebuah barang perhiasan bukanlah angka tetap yang Anda tetapkan sekali — ia dihitung ulang tepat pada saat penjualan, dari berat bersih barang itu sendiri, tarif pasar hari ini untuk logam dan kadar (purity) persisnya, dan biaya pembuatan. Tidak ada mekanisme penetapan harga lain di Sarang yang mencakup ini, termasuk penagihan lepas/berbasis-berat — fitur itu (digunakan untuk hal-hal seperti beras atau rempah yang dijual berdasarkan berat) menetapkan harga dengan tarif per-satuan-berat tetap yang *Anda* tetapkan dan yang tetap sama sampai Anda mengubahnya. Penetapan harga perhiasan berbeda khususnya karena tarifnya benar-benar berfluktuasi hari demi hari dengan pasar logam, dan harus dicari ulang setiap kali.

## Menyiapkan sebuah produk perhiasan

Saat membuat atau mengedit sebuah produk, tetapkan **Metal Type**-nya (Gold, Silver, atau Platinum) dan **Purity**-nya (misalnya "22K", "18K", "999"). Masukkan berat kotornya dan, jika ia memiliki batu atau material non-logam lainnya, sebuah berat batu untuk dikurangkan — Sarang selalu menghitung berat bersih sebagai kotor dikurangi berat batu itu sendiri; ini tidak pernah dipercayakan sebagai nilai yang diketik langsung pada produk, dengan cara yang sama harga label barcode tidak pernah dipercaya dari input luar.

Kemudian pilih bagaimana biaya pembuatan dihitung:

- **Fixed amount** — biaya pembuatan tetap terlepas dari berat.
- **Per gram (of net weight)** — sebuah tarif dikalikan berat bersih barang tersebut.
- **Percentage of metal value** — persentase dari (berat bersih × tarif hari ini).

## Metal Rates

Buka **Metal Rates** di sidebar untuk menetapkan tarif per gram hari ini untuk setiap kombinasi jenis-logam-dan-kadar yang Anda stok (emas 22K dan emas 18K benar-benar diperdagangkan pada tarif berbeda, sehingga setiap kombinasi mendapatkan barisnya sendiri). Tidak ada feed tarif internet otomatis — konsisten dengan desain offline-first Sarang, Anda mencari tarif hari ini di mana pun Anda biasa melakukannya dan mengetiknya. Perbarui ini setiap kali tarif berubah; setiap penjualan sejak saat itu menggunakan nilai saat ini.

## Bagaimana sebuah penjualan dihargai

Pada saat penagihan, menambahkan sebuah barang perhiasan ke keranjang mencari tarif jenis-logam dan kadarnya saat ini, menghitung nilai logam (berat bersih × tarif), menambahkan biaya pembuatan, dan menggunakan itu sebagai harga satuan baris tersebut. Jika belum ada tarif yang ditetapkan untuk kombinasi logam/kadar barang itu, Sarang tidak akan membiarkan Anda menagihnya dengan harga nol — Anda akan diminta untuk menetapkan tarif hari ini terlebih dahulu.

Perlu menegosiasikan biaya pembuatan untuk satu penjualan tertentu tanpa mengubah konfigurasi tarif produk itu sendiri? Edit langsung pada baris keranjang — harga baris tersebut dihitung ulang seketika, dan sebuah baris yang di-override ditandai secara visual sehingga terlihat jelas sekilas bahwa baris itu tidak menggunakan biaya standar.

Jika barang tersebut memiliki **nomor cap/HUID** yang tercatat pada produk, nomor itu ikut tercatat pada penjualan dan tercetak otomatis pada faktur.

## Tukar tambah logam lama

Buka **Old-Metal Exchange** untuk mencatat seorang pelanggan yang menukar emas atau perak lama terhadap pembelian baru. Masukkan berat kotor, berat pengurangan (untuk konten non-logam apa pun), jenis logam, dan kadar — Sarang mencari tarif hari ini untuk kombinasi tersebut dan menghitung nilai yang diberikan kepada pelanggan (berat bersih × tarif).

Untuk menggunakannya, klik **Apply Old-Metal Exchange** saat menagih pelanggan tersebut — Sarang menampilkan kredit itu dan langsung memasukkannya ke dalam diskon faktur saat penjualan dibuat, serta menandai pertukaran tersebut sebagai sudah terpakai sehingga tidak bisa secara tidak sengaja diterapkan kedua kalinya ke faktur yang berbeda.

## Returns

Jewellery memiliki modul Returns yang diaktifkan, alur kerja pemrosesan-retur yang sama yang digunakan Retail, Clothing, dan Footwear.

## Reports

**Reports** mencakup laporan stok perhiasan yang menunjukkan berat bersih, tarif saat ini, dan total penilaian dikelompokkan berdasarkan jenis logam dan kadar.

## Bahasa

Jewellery bukan salah satu template bisnis-layanan Sarang — ini adalah jenis bisnis kategori-produk, sehingga **tidak** dikunci-bahasa. Seluruh antarmuka tersedia dalam ke-13 bahasa yang didukung.
