// Collection permission never renders UI or implies a visitor consented.
export class CollectionState {
  constructor({ mode, preferenceKey, storage, changed, error }) {
    if (mode != null && !['automatic', 'consent'].includes(mode)) throw new Error('Invalid collection mode');
    this.mode = mode ?? null;
    this.permission = 'not_provided';
    this.refused = false;
    this.destroyed = false;
    this.preferenceKey = preferenceKey;
    this.storage = storage;
    this.changed = changed;
    this.error = error;
    this.refresh();
  }
  get enabled() {
    return !this.destroyed && !this.refused && (this.mode === 'automatic' || (this.mode === 'consent' && this.permission === 'granted'));
  }
  refresh() {
    try { this.refused = this.storage()?.getItem(this.preferenceKey) === 'refused'; }
    catch { this.error('preference_storage_unavailable'); }
  }
  saveRefusal(refused) {
    this.refused = refused;
    try {
      const storage = this.storage();
      if (!storage) throw new Error('Storage unavailable');
      if (refused) storage.setItem(this.preferenceKey, 'refused');
      else storage.removeItem(this.preferenceKey);
    } catch { this.error('preference_storage_unavailable'); }
  }
  setMode(mode) {
    if (!['automatic', 'consent'].includes(mode)) throw new Error('Invalid collection mode');
    this.mode = mode;
    this.changed();
  }
  setConsent(granted) {
    this.permission = granted ? 'granted' : 'denied';
    this.saveRefusal(!granted);
    this.changed();
  }
  optOut() {
    this.permission = 'denied';
    this.saveRefusal(true);
    this.changed();
  }
  optIn() {
    this.saveRefusal(false);
    if (this.permission === 'denied') this.permission = 'not_provided';
    this.changed();
  }
  receiveRefusal() {
    // Other tabs may stop this instance, but never grant permission on its behalf.
    this.refused = true;
    this.permission = 'denied';
    this.changed();
  }
  metadata() {
    return { collection_mode: this.mode, consent_state: this.permission === 'granted' ? 'granted' : 'not_provided' };
  }
}
