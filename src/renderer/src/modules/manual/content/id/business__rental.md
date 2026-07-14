# Rental Business

## Apa yang berbeda dari jenis bisnis ini

Rental Business dengan sengaja bersifat generik — dibangun untuk mencakup penyewaan checkout-dan-return jangka pendek apa pun, baik itu tenda dan peralatan makan untuk pernikahan, pakaian, mobil atau motor, rumah singgah jangka pendek, perhiasan-untuk-sehari, stasiun gaming, elektronik, atau furnitur. Yang dimiliki bersama oleh semua ini adalah siklus hidup booking → checkout → return yang sama, ditagih dengan tarif berbasis waktu alih-alih harga jual satu-kali. Ini berbeda dari modul Property milik Real Estate, yang untuk sewa jangka panjang tanpa siklus checkout/return sama sekali.

## Pelacakan UNIT vs. BULK

Setiap produk yang dapat disewa dilacak dengan salah satu dari dua cara:

- **UNIT** — untuk aset yang berbeda secara individual, seperti satu mobil tertentu, satu gaun pengantin tertentu, atau konsol gaming bernomor. Setiap barang fisik mendapatkan entrinya sendiri di **Rental Units** dengan label unit dan catatan kondisi, dan sebuah booking mengklaim satu unit tertentu untuk rentang tanggalnya.
- **BULK** — untuk kuantitas yang dipooling dan dapat dipertukarkan, seperti "50 kursi plastik" atau "20 piring makan." Tidak ada identitas per-item, hanya total kuantitas yang dimiliki dan berapa banyak yang sudah dikomit ke booking yang tumpang tindih.

## Menetapkan tarif sewa

Sebuah produk yang bisa disewa dapat memiliki tarif untuk kombinasi apa pun dari **HOUR, DAY, WEEK, MONTH, atau YEAR** — tetapkan mana pun yang berlaku saat Anda menandai sebuah produk sebagai bisa disewa. Sebuah booking memilih satu basis tarif per barang; durasi dihitung dalam satuan tersebut dan dibulatkan ke atas (sebuah booking yang sedikit lebih dari satu hari tetap ditagih sebagai satu hari penuh, tidak pernah sebagian).

## Siklus hidup booking

Buka **Rental Bookings** di sidebar. Sebuah booking bergerak melalui:

1. **Reserved** — dibuat untuk seorang pelanggan, rentang tanggal/waktu, dan satu atau lebih barang, dengan deposit jaminan opsional yang dikumpulkan di muka.
2. **Checked Out** — barang secara fisik pergi bersama pelanggan. Untuk barang UNIT, status unit tertentu menjadi Rented.
3. **Returned** — barang kembali. Anda mencatat biaya kerusakan apa pun dan berapa banyak deposit jaminan yang dikembalikan (secara default, deposit dikurangi biaya kerusakan apa pun). Jika pengembalian terlambat, biaya keterlambatan dihitung otomatis dari tarif masing-masing barang, dinormalisasi ke angka per-hari, dikali pengali biaya-keterlambatan yang dapat dikonfigurasi (1,5× secara default).

Sebuah booking Reserved juga dapat **Dibatalkan** (sebelum checkout) atau **Diperpanjang** ke tanggal/waktu akhir yang lebih lambat (selama barang tetap tersedia sepanjang rentang baru).

## Ketersediaan selalu langsung, tidak pernah pengurangan stok

Sarang tidak pernah mengurangi kuantitas stok saat sebuah sewa di-checkout. Sebaliknya, ketersediaan — untuk barang UNIT maupun BULK — dihitung langsung dari setiap booking Reserved atau Checked-Out saat ini yang tumpang tindih dengan rentang tanggal yang diminta. Ini penting karena sebuah reservasi harus memblokir ketersediaan *sebelum* checkout — dua pelanggan yang mencoba memesan tenda terakhir yang sama untuk tanggal yang tumpang tindih tidak boleh keduanya berhasil, yang akan terlewat oleh model "kurangi hanya saat checkout".

## Billing

Membuat sebuah faktur dari booking yang selesai membuat baris item untuk biaya setiap barang yang disewa, ditambah baris terpisah untuk biaya keterlambatan dan biaya kerusakan apa pun. Deposit jaminan dengan sengaja **tidak** menjadi bagian dari faktur — ia dilacak hanya sebagai jumlah yang dikumpulkan/dikembalikan pada booking itu sendiri, karena itu adalah tahanan (holding), bukan pendapatan.

## Reports

**Reports** mencakup laporan Rental Status (apa yang saat ini sedang dikeluarkan, dan apa yang terlambat) dan laporan Rental Revenue per produk, termasuk persentase pemanfaatan untuk aset yang dilacak-UNIT.

## Bahasa

Rental Business bukan salah satu template bisnis-layanan Sarang — ini adalah jenis bisnis kategori-produk, sehingga **tidak** dikunci-bahasa. Seluruh antarmuka tersedia dalam ke-13 bahasa yang didukung.
