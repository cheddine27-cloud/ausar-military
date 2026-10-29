# Ausar Military Global Notification Engine

The **Global Notification Engine** provides a unified interface for outbound communications (SMS, WhatsApp, Email, Native Push).

## Usage
Use `NotificationEngine.send` to dispatch alerts:

```typescript
import { NotificationEngine } from '@/core/notifications/NotificationEngine';

await NotificationEngine.send({
  institutionId: 'inst-id',
  senderAdminId: 'admin-id',
  recipientType: 'parent',
  recipientId: 'guardian-id',
  recipientContact: '+213xxxxxxxxx',
  channel: 'sms',
  message: 'نعلمكم بتغيب ابنكم اليوم عن حصص الدراسة.',
  notificationCode: 'GC-2026-000001',
});
```

## Architectural Flow
1. Queues the notification inside `communication_queue` table with `message_snapshot` preservation and unique sequential `notification_code`.
2. Resolves preferred channel, formats template, and dispatches via gateway simulators in `NotificationProviders`.
3. Updates delivery status (sent/delivered/failed) inside the database queue.
