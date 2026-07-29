# Политика конфиденциальности — Mindful Wallet

_Дата вступления в силу: [укажите дату публикации]_

Это черновик политики конфиденциальности для приложения Mindful Wallet. Перед публикацией в App
Store / Google Play разместите этот текст на любой странице с постоянным URL (например, GitHub
Pages, Notion, ваш сайт) и укажите эту ссылку в App Store Connect / Google Play Console, а также
замените плейсхолдеры `[...]` реальными данными.

## Какие данные собирает приложение

Mindful Wallet не имеет собственного сервера и не собирает данные централизованно. Все данные —
записи о тратах, цели накоплений, недельные лимиты, очки и достижения — хранятся **только на
вашем устройстве** (в локальном хранилище приложения) и никогда не передаются разработчику.

## Данные, которые вы предоставляете сторонним ИИ-провайдерам

Если вы включаете функции ИИ-коуча, приложение отправляет запрос напрямую с вашего устройства на
сервер выбранного вами провайдера (Anthropic, OpenAI или Google) — минуя любые серверы
разработчика приложения. В запрос включаются:

- текст вашего вопроса или описание планируемой покупки;
- сводка ваших трат, бюджета и цели накоплений за текущую неделю, сформированная на устройстве.

Обработка этих данных на стороне провайдера регулируется его собственной политикой
конфиденциальности:

- Anthropic: https://www.anthropic.com/legal/privacy
- OpenAI: https://openai.com/policies/privacy-policy
- Google: https://policies.google.com/privacy

## Хранение API-ключей

Ключи API, которые вы вводите в Настройках, хранятся локально на устройстве в защищённом
зашифрованном хранилище (Keychain на iOS, Keystore на Android) и используются исключительно для
прямых запросов к серверу соответствующего провайдера.

## Уведомления

Приложение может показывать локальные push-уведомления (например, напоминания коуча). Эти
уведомления формируются и планируются на самом устройстве и не проходят через внешние
push-серверы разработчика.

## Передача третьим лицам и реклама

Приложение не продаёт и не передаёт ваши данные третьим лицам, не показывает рекламу и не
использует сторонние трекеры аналитики.

## Экспорт и импорт данных

В Настройках есть функция резервного копирования: вы можете экспортировать все свои данные
(включая API-ключи) в один файл на вашем устройстве и позже восстановить их из этого файла. Этот
файл создаётся и хранится полностью на вашей стороне — разработчик не получает и не видит его.
Обратите внимание: в отличие от хранения на устройстве, сам файл резервной копии не зашифрован,
поэтому храните и передавайте его так же осторожно, как любой файл с паролями.

## Удаление данных

Все данные удаляются при удалении приложения с устройства. Отдельно сохранённые файлы резервных
копий (см. выше) нужно удалять вручную.

## Контакты

По вопросам, связанным с конфиденциальностью, обращайтесь: `[укажите ваш контактный email]`.

---

## Privacy Policy — Mindful Wallet (English summary)

Mindful Wallet has no backend server. All spending records, goals, budgets, points, and
achievements are stored **locally on your device only** and are never transmitted to the app
developer. When you use the AI coach features, your device sends your question and a
device-generated summary of your spending/budget/goal directly to the AI provider you selected
(Anthropic, OpenAI, or Google) — governed by that provider's own privacy policy (linked above).
API keys you enter are stored in the device's encrypted secure storage (Keychain on iOS, Keystore
on Android) and used only for direct requests to that provider. An optional backup feature in
Settings lets you export all your data (including API keys) to a single unencrypted file that
stays entirely on your device, and import it back later — handle that file as carefully as a
password file. The app shows no ads, uses no third-party analytics trackers, and does not sell or
share your data.
