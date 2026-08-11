# Aset Tetap dan Penutupan Akhir Tahun

## Register Aset Tetap

Buka **Fixed Assets** dari bilah sisi dan klik **New Asset** untuk mencatat sesuatu yang dimiliki bisnis Anda dan digunakan dalam jangka waktu lama — kendaraan, peralatan, furnitur, laptop — bukan sesuatu yang dibeli untuk dijual kembali. Masukkan tanggal pembelian, biaya, umur manfaat (dalam bulan), metode penyusutan, dan nilai sisa (nilai yang mungkin dimilikinya setelah sepenuhnya disusutkan, sering kali nol).

Menambahkan aset di sini tidak membukukan entri pembelian tersendiri — pembelian itu sendiri sudah dicatat melalui Bill atau Expense saat Anda benar-benar membelinya. Register ini ada untuk melacak apa yang Anda miliki dan menyusutkannya dengan benar seiring waktu, bukan untuk mencatat pembelian untuk kedua kalinya.

## Menjalankan Penyusutan

Buka layar detail aset itu sendiri dan klik **Run Depreciation** untuk suatu periode. Sarang mendukung dua metode:

- **Straight-Line** (garis lurus) — jumlah yang sama setiap periode: (biaya − nilai sisa) ÷ umur manfaat.
- **WDV (Written-Down Value, nilai menurun)** — persentase yang menurun dari nilai buku aset saat ini di setiap periode, sehingga jumlah penyusutan paling besar di awal dan mengecil seiring waktu.

Setiap eksekusi membukukan Journal Entry sungguhan (Debit ke Depreciation Expense, Kredit ke Fixed Assets) dan memperbarui akumulasi penyusutan aset. Menjalankan penyusutan dua kali untuk periode yang sama diblokir sepenuhnya — Sarang tidak akan membiarkan Anda membukukannya dua kali secara tidak sengaja.

## Melepas Aset (Dispose)

Saat Anda menjual, membuang, atau menghapusbukukan aset, buka aset tersebut dan klik **Dispose**. Masukkan tanggal pelepasan dan (jika terjual) jumlah yang diterima. Sarang membandingkannya dengan nilai buku aset saat ini dan membukukan selisihnya sebagai laba atau rugi sungguhan — penjualan di atas nilai buku adalah laba, di bawahnya adalah rugi — sehingga pelepasan tersebut tercermin dengan benar di pembukuan Anda, tidak hanya ditandai tidak aktif.

## Menutup Tahun Fiskal Anda

Pada akhir tahun, buka **Ledger Settings** dan gunakan **Year-End Close**. Ini adalah tindakan sungguhan dan permanen: menghitung saldo setiap akun hingga tanggal penutupan, memasukkan laba atau rugi bersih tahun tersebut ke dalam Owner's Capital (praktik akuntansi standar mengatur ulang akun pendapatan dan pengeluaran ke nol setiap tahun sambil membawa maju apa yang benar-benar diperoleh atau dibelanjakan ke ekuitas), dan membukukan satu entri pembukaan yang membawa setiap saldo ke tahun baru.

Tanggal penutupan kemudian dikunci secara otomatis melalui mekanisme Transaction Locking yang sama seperti dijelaskan pada bab Buku Besar dan Jurnal — tidak ada yang dapat diedit di tahun yang ditutup setelahnya, sementara data setiap tahun yang ditutup tetap sepenuhnya utuh dan dapat dilihat, tidak pernah dihapus atau diarsipkan di luar jangkauan.

Year-End Close menolak untuk dijalankan lagi pada periode yang sudah ditutup, dan menolak untuk dijalankan pada periode tanpa aktivitas sungguhan untuk dibawa maju — sehingga tidak pernah berjalan dua kali secara tidak sengaja, dan tidak pernah membukukan entri yang kosong atau tidak bermakna.
