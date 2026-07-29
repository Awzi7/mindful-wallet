import AsyncStorage from '@react-native-async-storage/async-storage';
import { addNotification, getNotifications, getUnreadNotificationCount, markAllNotificationsRead } from '../storage';

describe('in-app notifications', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('starts empty', async () => {
    expect(await getNotifications()).toEqual([]);
    expect(await getUnreadNotificationCount()).toBe(0);
  });

  it('adds a notification as unread, most recent first', async () => {
    await addNotification('First', 'body one');
    await addNotification('Second', 'body two');

    const list = await getNotifications();
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ title: 'Second', body: 'body two', read: false });
    expect(list[1]).toMatchObject({ title: 'First', body: 'body one', read: false });
    expect(await getUnreadNotificationCount()).toBe(2);
  });

  it('marks everything read without touching content', async () => {
    await addNotification('Title', 'Body');
    await markAllNotificationsRead();

    const list = await getNotifications();
    expect(list[0]).toMatchObject({ title: 'Title', body: 'Body', read: true });
    expect(await getUnreadNotificationCount()).toBe(0);
  });

  it('caps history at 50 entries, dropping the oldest', async () => {
    for (let i = 0; i < 55; i++) {
      await addNotification(`Notification ${i}`, 'body');
    }
    const list = await getNotifications();
    expect(list).toHaveLength(50);
    expect(list[0].title).toBe('Notification 54');
    expect(list[49].title).toBe('Notification 5');
  });
});
