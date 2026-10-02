# Serula Nesting Pro - CorelDRAW Macro

Bu makro CorelDRAW ile Serula Nesting Pro PC arasinda **yerel dosya koprusu** kurar. CorelDRAW'in internete erismesi gerekmez.

## Hedef uyumluluk

- CorelDRAW X7 / X8
- CorelDRAW 2017-2026
- 32-bit ve 64-bit VBA ortamlari

Kod WinAPI kullanmaz ve Corel surumune ozel DLL referansi istemez. X5/X6 gibi daha eski surumlerde de kullanilan temel Export/Import API'lerine dayanir, ancak bunlar resmi test hedefi degildir.

## Makrolar

- `Serula_Gonder`: Corel'de secili objeleri DXF olarak yerel klasore aktarir ve Serula Nesting Pro PC'yi acarak dosyayi otomatik yukler.
- `Serula_Sonucu_Al`: Serula'da indirilen nesting sonucunu aktif Corel belgesine geri alir.
- `Serula_Klasoru_Ac`: Yerel aktarim klasorunu acar.

## Kurulum

1. Serula Nesting Pro PC'yi kurun ve en az bir kez acin.
2. CorelDRAW'da VBA/Visual Basic for Applications ozelliginin kurulu oldugundan emin olun.
3. CorelDRAW Macro Manager / Visual Basic Editor'u acin.
4. GlobalMacros veya kendi GMS projenizde bir module `SerulaNesting.bas` dosyasini import edin.
5. Isterseniz `Serula_Gonder` ve `Serula_Sonucu_Al` makrolarini toolbar butonlarina atayin.

Menu adlari Corel surumune gore Tools > Macros, Tools > Scripts veya Macro Manager olarak gorunebilir.

## Kullanim

1. CorelDRAW'da nesting'e gidecek parcalari secin.
2. `Serula_Gonder` calistirin.
3. Serula PC acilir ve DXF otomatik ice aktarilir.
4. Serula'da nesting yapin ve **DXF Indir**'e basin.
5. Corel'e donun ve `Serula_Sonucu_Al` calistirin.

Tum Corel <-> Serula dosya aktarimi yereldir. DXF'ler kullanici profilindeki `SerulaNesting\CorelBridge` klasorunde tutulur.
