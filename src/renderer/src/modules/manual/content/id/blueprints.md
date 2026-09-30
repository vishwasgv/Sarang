# Blueprint: Pelacakan Tahap Dokumen

## Apa itu ini

**Blueprint** memungkinkan Anda menentukan rangkaian tahapan bernama yang dilalui sebuah dokumen secara terlihat — misalnya **Draf → Disetujui → Dikirim ke Pemasok → Diterima** untuk Pesanan Pembelian, atau istilah Anda sendiri untuk Pesanan Penjualan. Ini adalah cara sederhana dan visual untuk melihat *di mana sebenarnya* posisi dokumen dalam proses bisnis Anda sendiri, di luar status sistemnya (Draf, Dikonfirmasi, Ditagih, dan seterusnya).

Blueprint saat ini berlaku untuk dua jenis dokumen: **Pesanan Pembelian** dan **Pesanan Penjualan**. Setiap jenis dokumen memiliki kumpulan tahapnya sendiri yang independen — alur yang Anda atur untuk Pesanan Pembelian tidak memengaruhi Pesanan Penjualan sama sekali, begitu juga sebaliknya.

Seperti Alur Kerja Persetujuan, Blueprint **nonaktif secara default** dan sepenuhnya **opsional**. Jika Anda tidak pernah mengatur tahap apa pun untuk suatu jenis dokumen, tidak ada yang berubah di mana pun — tidak ada widget yang muncul, dan dokumen bekerja persis seperti biasa.

## Mengatur tahap (Pengaturan)

Pemilik atau admin mengatur tahap dari **Pengaturan**, di bagian Blueprint. Pilih jenis dokumen (Pesanan Penjualan atau Pesanan Pembelian), lalu tambahkan tahap satu per satu dengan mengetik nama dan mengonfirmasi — setiap tahap baru ditambahkan ke akhir alur.

Ada beberapa batasan nyata yang perlu diketahui:

- **Maksimal 20 tahap** per jenis dokumen. Jika sudah mencapai batas, nonaktifkan (retire) satu tahap yang tidak lagi diperlukan sebelum menambahkan tahap baru.
- **Tidak boleh ada nama yang sama** dalam satu jenis dokumen — pemeriksaan ini tidak membedakan huruf besar/kecil.
- Nama tahap dapat memiliki panjang hingga **80 karakter**.
- Gunakan kontrol naik/turun di samping setiap tahap untuk **mengurutkan ulang** alur kapan saja — ini hanya mengubah urutan tampilan tahap; tidak memengaruhi dokumen mana pun yang sudah berada di salah satu tahap tersebut.
- Menghapus tahap dari daftar tidak menghapusnya secara permanen, melainkan **menonaktifkannya (retire)**. Ini penting karena dokumen nyata mungkin sudah berada di tahap tersebut; menonaktifkannya menjaga riwayat itu tetap utuh sambil menghentikan tahap tersebut dari penggunaan baru. Tahap yang dinonaktifkan tidak lagi muncul di alur, maupun sebagai pilihan untuk memajukan dokumen.

Mengatur tahap (menambah, mengurutkan ulang, menonaktifkan) memerlukan izin yang sama dengan mengubah pengaturan bisnis lainnya. Seseorang yang hanya bisa melihat Pengaturan dapat melihat tahap yang telah diatur, tetapi tidak dapat mengubahnya.

## Melihat dan memajukan tahap dokumen

Setelah suatu jenis dokumen memiliki setidaknya satu tahap yang diatur, setiap dokumen dari jenis itu menampilkan pelacak tahap langsung di layar detailnya sendiri — di layar detail **Pesanan Pembelian** maupun **Pesanan Penjualan**, berdampingan dengan panel persetujuan dokumen itu (jika ada yang diatur). Pelacak menampilkan seluruh alur sebagai satu baris tahap; tahap dokumen saat ini disorot, dan tahap-tahap sebelumnya ditandai selesai.

Dokumen yang belum pernah dipindahkan secara otomatis dianggap berada di **tahap pertama** — saat Anda mengaktifkan Blueprint untuk suatu jenis dokumen, Anda tidak perlu kembali ke dokumen yang sudah ada untuk mengatur tahap awalnya; sampai seseorang memajukannya, dokumen tersebut dianggap berada di tahap pertama.

Untuk memajukan dokumen, klik langsung tahap yang dituju — Anda **tidak** wajib melalui tahap satu per satu secara berurutan; tahap mana pun yang sudah diatur dapat dipilih langsung. Mengklik tahap tempat dokumen sudah berada tidak melakukan apa-apa.

## Ini bukan gerbang persetujuan

Blueprint adalah alur status yang Anda tentukan sendiri secara bebas untuk pelacakan Anda sendiri — ini **bukan** kontrol tanda tangan persetujuan atau izin. Memindahkan dokumen dari satu tahap ke tahap berikutnya hanya memerlukan izin yang sama yang sudah memungkinkan seseorang membuat atau mengedit jenis dokumen tersebut; tidak ada pengaturan terpisah untuk "siapa yang bisa memajukan tahap", dan tidak ada tahap yang dapat memblokir atau mensyaratkan persetujuan sebelum dokumen maju. Jika Anda memerlukan dokumen untuk memerlukan tanda tangan persetujuan di atas jumlah tertentu sebelum dikonfirmasi, itulah fungsi **Alur Kerja Persetujuan** — Blueprint dan Alur Kerja Persetujuan dapat digunakan bersama pada dokumen yang sama, tetapi keduanya melakukan tugas yang berbeda: Alur Kerja Persetujuan mengontrol apakah dokumen *bisa* dikonfirmasi; Blueprint hanya menunjukkan *di mana* dokumen itu berada setelahnya, dalam alur yang Anda rancang.

## Jika suatu jenis dokumen belum memiliki tahap yang diatur

Jika Anda belum mengatur tahap apa pun untuk Pesanan Pembelian atau Pesanan Penjualan, pelacak tahap tidak akan muncul di layar dokumen-dokumen tersebut — tidak ada yang perlu dinonaktifkan atau disembunyikan secara terpisah. Mengatur tahap pertama untuk suatu jenis dokumen sudah cukup agar pelacak muncul di setiap dokumen berikutnya dari jenis tersebut.
