-- Populate the category directory without importing demo accounts or tickets.
-- Preserve existing names, IDs, descriptions and administrator changes.
INSERT INTO "Category" ("id", "name") VALUES
  ('f70222ae-83a6-5417-a63b-5318c0848cab', 'Договорная работа'),
  ('85e28464-a7a0-593e-a5fd-c55df206ee01', 'Документооборот'),
  ('3e6235d2-5208-524d-aebb-7956eeee8498', 'Задачи и коммуникации'),
  ('ac7612a7-0901-535b-a447-bd09dd7af213', 'Знания и наставничество'),
  ('ce90cd60-8992-5796-ac30-f7fd146ced1e', 'Интеграции и IT'),
  ('bb0fd13f-89f0-59c9-a716-95b31230fcbd', 'Информационная прозрачность'),
  ('c163d4d9-dfd6-512a-a200-ad9e22a6959c', 'Каталог и данные'),
  ('76972b0c-1540-5f58-a27f-89bda97830bb', 'Коммуникации'),
  ('af7a74f1-23b9-5026-a3c8-c55f62e728bc', 'Корпоративная среда'),
  ('8b840cbe-5962-5bcf-a840-8f543c6ad881', 'Межотдельное взаимодействие'),
  ('921aa624-f475-5917-a943-b5b6318efb8d', 'Обучение'),
  ('d7665d11-40fb-570b-a85a-114e88b5bef9', 'Оперативность'),
  ('6c9ef48b-5abe-5ba9-a5e3-c505c549dc65', 'Планирование ресурсов'),
  ('415acbb6-dad5-5c7c-a254-96f571e60a5d', 'Постановка задач'),
  ('8d60fa5b-a8c4-5a72-a58f-08b54b96a5cc', 'Проектная деятельность'),
  ('739f9e84-9e2b-5d2f-a1b4-fbd0a6e34498', 'Прозрачность результатов'),
  ('5ad8c7c9-5769-5633-ab5a-5d50575c238e', 'Регламенты'),
  ('e1b4b20c-c450-5cd8-ab8f-a54535a40ba2', 'Хранение документов')
ON CONFLICT DO NOTHING;
