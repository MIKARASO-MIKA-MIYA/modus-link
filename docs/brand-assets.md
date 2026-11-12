# Логотип и favicon

В Sidebar главной страницы (`home-shell.tsx`) и компактном Sidebar (`ui/icon.tsx`) подключён `public/modus-link-logo.png`: бело-красный знак из предоставленного изображения `Глянцевый логотип из двух лент на тёмно-синем фоне.png`. PNG имеет прозрачный фон, пропорции 3:2; CSS сохраняет пропорции через `object-fit: contain`.

Фон удалён встроенным imagegen в режиме редактирования с `transparent_background: true`. После этого sharp обрезал прозрачные поля, подготовил размер 768×512 и favicon. Результат генеративного удаления фона визуально проверен отдельно на подложке #0A1427; это обработанная версия исходного изображения, а не исходный векторный мастер.

`public/favicon.ico` содержит размеры 16, 32 и 48 px; `public/favicon-32.png` — альтернативный PNG. Для читаемости белой части знака favicon использует подложку #0A1427. Root metadata указывает оба файла с `?v=original-logo` для обновления кеша вкладки. Прежние SVG больше не подключены к этим местам.

Промпт удаления фона:

```text
Use case: background-extraction. Edit target: the supplied MODUS LINK white and red folded-ribbon M brand mark. Remove ONLY the dark blue background and all outer glow. Preserve the actual original logo design exactly: same white left ribbon, silver-gray folded rear face, vivid red rising central ribbon and darker red rear/right leg, same rounded ends, silhouette, proportions and overlap. Do NOT redesign, simplify, trace into a different M, add elements or text. Keep the internal original material shading. Output a tightly framed clean cutout of ONLY this existing logo on genuine alpha transparency with a small even transparent margin (about 5%), no backdrop, shadow, halo, checkerboard artwork or lettering. Landscape aspect ratio matching the mark, about 3:2. This is the existing identity, not a new logo.
```

Проверено по HTTP на http://127.0.0.1:3001: root HTML содержит актуальные icon links, все три изображения возвращаются с 200 и корректным MIME-типом. Это проверка работающего сервера и ресурсов, не визуальная проверка вкладки браузера.
