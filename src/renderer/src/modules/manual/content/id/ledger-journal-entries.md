# Buku Besar dan Jurnal

## Entri yang Dibukukan Secara Otomatis

Setiap tindakan pergerakan uang sungguhan yang sudah Anda lakukan di Sarang — membuat Invoice, mencatat Bill, menerima Payment, membayar Supplier, mencatat Expense, mencairkan Post-Dated Cheque, menjalankan penyusutan Fixed Asset — sekarang juga secara otomatis membukukan jurnal pembukuan berpasangan (double-entry) yang seimbang dan nyata di balik layar. Anda tidak perlu melakukan apa pun yang berbeda sehari-hari; inilah yang membuat Trial Balance, Chart of Accounts, dan saldo Bank Account benar-benar cocok satu sama lain, bukan angka yang dilacak secara terpisah yang bisa diam-diam berbeda satu sama lain.

Membatalkan, meng-void, atau membalik salah satu tindakan yang sama tersebut membukukan entri pembalik (reversing) yang benar-benar dicerminkan, bukan hanya penghapusan — sehingga buku besar selalu menunjukkan apa yang sebenarnya terjadi, termasuk koreksi, tanpa menulis ulang sejarah.

## Chart of Accounts

Buka **Chart of Accounts** dari bilah sisi untuk melihat akun-akun tempat pembukuan Anda dibangun — Cash & Bank, Accounts Receivable, Inventory, Fixed Assets, Accounts Payable, Tax Payable, Owner's Capital, Sales Revenue, Cost of Goods Sold, Operating Expenses, dan beberapa lainnya — sudah disiapkan untuk Anda begitu Anda menggunakan apa pun dari fase ini untuk pertama kalinya. Setiap akun memiliki tipe (Asset, Liability, Equity, Income, atau Expense), yang menentukan di sisi mana buku besar akun tersebut biasanya berada.

Klik **New Account** untuk menambahkan akun Anda sendiri — berguna jika Anda menginginkan kategori pengeluaran atau pendapatan yang lebih spesifik daripada default (misalnya membagi "Operating Expenses" menjadi "Rent" dan "Utilities" untuk pelacakan Anda sendiri). Akun Anda sendiri berperilaku persis seperti akun bawaan di tempat lain mana pun di buku besar.

## Membukukan Jurnal Manual

Sebagian besar entri dibukukan secara otomatis seperti dijelaskan di atas, tetapi terkadang Anda perlu mencatat sesuatu secara manual — mengoreksi pengeluaran yang salah klasifikasi, mencatat penyesuaian non-tunai, atau entri apa pun yang tidak sesuai dengan salah satu jenis transaksi Sarang sendiri. Buka **Journal Entries** dan klik **New Entry**.

Tambahkan dua baris atau lebih, masing-masing terhadap satu akun, sebagai debit atau kredit — tidak pernah keduanya pada baris yang sama. Sarang menjumlahkan kedua kolom saat Anda mengetik dan menolak untuk membukukan hingga keduanya cocok persis — entri yang tidak seimbang ditolak langsung, disiplin yang sama yang sudah diikuti oleh setiap pencatatan keuangan lain di Sarang.

Entri yang sudah dibukukan dapat dibalik (dengan alasan yang wajib diisi) jika salah satu dicatat karena kesalahan — ini membukukan entri cerminan yang benar-benar nyata, bukan menghapus entri aslinya, sehingga koreksi itu sendiri menjadi bagian dari catatan permanen.

## Transaction Locking

Buka **Ledger Settings** untuk menetapkan **Lock Date** — setelah ditetapkan, tidak ada transaksi keuangan bertanggal (Invoice, Bill, Payment, Supplier Payment, Expense, Journal Entry, atau Purchase Order) pada atau sebelum tanggal tersebut yang dapat dibuat, diedit, atau di-void di bagian mana pun dari aplikasi. Inilah yang membuat periode akuntansi yang ditutup tetap tertutup — setelah Anda dan akuntan Anda sepakat bahwa satu bulan atau tahun sudah final, Lock Date mencegah siapa pun (termasuk Anda) diam-diam mengubahnya nanti.

## Bunga Pelanggan yang Menunggak

Jika Anda mengenakan bunga atas saldo pelanggan yang menunggak, aktifkan **Credit Interest** di Settings dengan suku bunga dan tipe Simple atau Compound. Kemudian dari catatan pelanggan itu sendiri, Anda dapat melihat bunga yang benar-benar terakumulasi pada faktur-faktur mereka yang menunggak — dihitung per faktur sejak tanggal faktur tersebut benar-benar menunggak, bukan perkiraan datar atas seluruh saldo — dan membukukannya sebagai biaya sungguhan ke akun mereka saat Anda siap untuk menagihnya.

## Reverse Charge, Composition Scheme, dan TDS

- **Reverse Charge (RCM)** — tandai Bill atau Expense sebagai reverse-charge saat pemasok tidak mengenakan GST kepada Anda dan Anda menilai sendiri pajak tersebut. Sarang menjaga apa yang benar-benar Anda hutangi kepada pemasok tetap terpisah dari pajak yang Anda hutangi kepada pemerintah, dan menampilkan total pajak reverse-charge dalam laporan pratinjau GSTR-3B.
- **Composition Scheme** — jika bisnis Anda terdaftar di bawah Composition Scheme (diatur di Settings), setiap Invoice yang Anda buat secara otomatis tidak mengenakan GST sama sekali, dan dicetak sebagai **Bill of Supply** alih-alih faktur pajak — sesuai dengan yang diwajibkan hukum, tanpa Anda perlu mengingat untuk menolkan pajak secara manual pada setiap penjualan.
- **TDS pada pembayaran pemasok** — saat mencatat pembayaran kepada pemasok, centang **Deduct TDS** dan Sarang menyarankan jumlah berdasarkan ambang batas dan tarif yang telah Anda konfigurasi, yang selalu dapat Anda tinjau dan sesuaikan sebelum konfirmasi. Jumlah yang ditahan dilacak sebagai kewajibannya sendiri, terpisah dari yang benar-benar dibayarkan.

## Trial Balance

Laporan **Trial Balance** (di bawah Reports) membaca langsung dari buku besar sungguhan yang dijelaskan di atas — saldo berjalan setiap akun hingga tanggal yang Anda pilih, debit dan kredit selalu berjumlah total yang sama, karena setiap entri yang pernah dibukukan ke dalamnya diharuskan seimbang dengan sendirinya.
