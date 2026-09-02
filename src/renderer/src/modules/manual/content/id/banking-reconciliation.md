# Perbankan dan Rekonsiliasi

## Rekening Bank dan Kas

Buka **Bank Accounts** dari bilah sisi dan klik **New Account** untuk menambahkan rekening bernama — rekening bank sungguhan (dengan nama bank, nomor rekening tersamar, dan IFSC) atau laci/kasir uang tunai, yang dipilih melalui kolom **Account Type**. Ini menggantikan satu kumpulan "uang tunai" yang tidak terpisah dengan sebanyak mungkin rekening nyata dan terpisah sesuai yang benar-benar dimiliki bisnis Anda — satu rekening giro utama, satu laci uang receh, kasir cabang kedua — masing-masing dilacak secara terpisah.

Jika rekening tersebut sudah memiliki uang sungguhan pada hari Anda menambahkannya, masukkan itu sebagai **Opening Balance**. Sarang membukukan satu entri penyeimbang sekali saja (Debit ke rekening, Kredit ke Owner's Capital) sehingga saldo rekening — dan pembukuan Anda — benar sejak hari pertama, tidak diam-diam dimulai dari nol.

**Current Balance** dari rekening bank selalu mencerminkan saldo nyata dan berjalan yang terbentuk dari setiap transaksi yang dibukukan padanya — pembayaran faktur yang dikreditkan ke dalamnya, tagihan yang dibayar darinya, cek yang dicairkan melaluinya, dan seterusnya — ini bukan angka yang pernah diedit langsung.

## Mengimpor dan Merekonsiliasi Rekening Koran

Buka rekening bank dan buka **Reconciliation**. Klik **Import Statement** untuk membawa masuk baris rekening koran bank Anda — tanggal, deskripsi, jumlah debit atau kredit — baris yang sama persis dengan yang sudah ditampilkan rekening koran bank Anda (PDF atau CSV), dimasukkan sekali, alih-alih dicocokkan secara manual dengan setiap transaksi di Sarang.

Setelah diimpor, klik **Auto-Match** — Sarang mencari transaksi Sarang (Payment, Expense, Supplier Payment, atau baris Journal Entry yang terhubung ke bank) dengan jumlah yang sama, bertanggal dalam beberapa hari dari baris rekening koran. Jika ditemukan tepat satu transaksi seperti itu, transaksi tersebut direkonsiliasi secara otomatis. Jika lebih dari satu bisa cocok, atau tidak ada yang cocok, baris tersebut sengaja dibiarkan untuk peninjauan Anda — tebakan yang mungkin salah lebih buruk daripada "perlu diperiksa" yang jujur.

Untuk yang tidak diselesaikan oleh Auto-Match, buka baris tersebut dan rekonsiliasikan secara manual dengan transaksi yang sebenarnya sesuai, atau biarkan tidak direkonsiliasi jika memang belum cocok dengan apa pun di Sarang (biaya bank, kredit bunga). Baris yang sudah direkonsiliasi selalu dapat dibatalkan dengan **Unreconcile** jika dicocokkan dengan baris yang salah.

**Reconciliation Summary** di bagian atas layar menampilkan saldo buku Anda di samping pergerakan bersih rekening koran itu sendiri, ditambah berapa banyak baris yang direkonsiliasi dan berapa yang masih tertunda — pemeriksaan "apakah buku saya cocok dengan bank?" yang sama seperti yang dilakukan akuntan secara manual, dilakukan untuk Anda.

## Melampirkan File Rekening Koran Asli

File rekening koran asli — PDF atau CSV yang dikirim bank Anda — dapat dilampirkan langsung ke rekening melalui panel **Documents** pada layar Reconciliation, sehingga dokumen sumber tetap berada di samping baris yang telah diproses selama Anda memerlukannya — perilaku lampirkan/buka/hapus yang sama yang sudah dimiliki setiap dokumen lain di Sarang.

## Cek Mundur (Post-Dated Cheques)

Buka **Post-Dated Cheques** dari bilah sisi untuk melacak register cek — nomor cek, rekening bank yang terhubung, tanggal jatuh tempo, jumlah, dan arah (Received dari pelanggan, atau Issued kepada pemasok). Cek yang Anda catat dimulai sebagai **Pending** dan belum menyentuh pembukuan Anda — persis seperti cara kerja cek mundur sungguhan: ini masih janji, bukan transaksi.

Ketika tanggal cek tiba dan benar-benar dicairkan di bank, tandai sebagai **Cleared** — hanya saat itulah Sarang membukukan pembayaran sungguhan (Debit atau Kredit ke Cash, terhadap saldo pelanggan atau pemasok yang diselesaikannya). Jika kembali tanpa dibayar, tandai sebagai **Bounced**; jika dibatalkan sebelum salah satu hasil tersebut, tandai sebagai **Cancelled**. Keduanya hanyalah perubahan status tanpa entri keuangan apa pun, karena keduanya tidak pernah benar-benar menjadi uang sungguhan.

## Slip Setoran Bank

Buka **Bank Deposits** untuk mencatat kunjungan nyata ke bank — uang tunai dan cek yang Anda serahkan di loket. Pilih rekening tujuan dan tanggal, lalu masukkan berapa lembar uang dari setiap pecahan (dari ₹500 hingga ₹1) yang benar-benar Anda bawa; Sarang menjumlahkan uang tunai untuk Anda saat mengetik. Jika rekening memiliki cek **Received** yang tertunda untuk disetorkan, centang yang akan ikut dalam kunjungan ini — totalnya ditambahkan ke slip, dan masing-masing berpindah dari Pending ke Deposited.

Hanya bagian tunai yang diperlakukan sebagai uang sungguhan begitu Anda menyimpan slip — ini langsung ditambahkan ke saldo rekening tujuan, sama seperti penjualan tunai. Cek yang Anda sertakan belum dihitung sebagai uang — masing-masing baru memengaruhi pembukuan Anda saat Anda menandainya secara terpisah sebagai **Cleared** di layar Post-Dated Cheques (cek yang sudah disetor masih bisa ditolak), jadi tidak pernah dihitung dua kali. Klik setoran sebelumnya mana pun dalam daftar untuk melihat kembali rincian lengkap pecahan dan ceknya.

## Buku Cek

Jika Anda menerbitkan cek kepada pemasok, klik **Cheque Books** di layar Post-Dated Cheques untuk mendaftarkan buku cek fisik untuk sebuah rekening bank — cukup nomor cek awal dan akhirnya. Ketika Anda kemudian mencatat cek **Issued** terhadap rekening tersebut, muncul kotak centang **Use next cheque book number (#...)**; mencentangnya secara otomatis mengisi nomor urut berikutnya dari buku tersebut alih-alih Anda mengetiknya sendiri, dan penghitung "berikutnya" milik buku itu bergerak maju sehingga nomor yang sama tidak akan pernah disarankan dua kali. Buku yang sudah habis terpakai ditampilkan sebagai **Exhausted**; nonaktifkan buku yang tidak lagi Anda gunakan agar berhenti ditawarkan.
