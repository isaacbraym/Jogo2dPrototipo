import { titleScreen } from './title';
import { editorScreen } from './editor';
import { gameScreen } from './game';
import { Life } from '../game/state';
import { clear } from './dom';

interface ScreenInst { el: HTMLElement; destroy: () => void }

/** Roteador simples entre telas. */
export class App {
  private cur: ScreenInst | null = null;
  constructor(public root: HTMLElement) {}

  go(name: 'title'): void;
  go(name: 'editor', opts?: { presets?: boolean }): void;
  go(name: 'game', life: Life): void;
  go(name: string, arg?: any) {
    this.cur?.destroy();
    clear(this.root);
    let s: ScreenInst;
    if (name === 'editor') s = editorScreen(this, arg ?? {});
    else if (name === 'game') s = gameScreen(this, arg as Life);
    else s = titleScreen(this);
    this.cur = s;
    this.root.appendChild(s.el);
  }
}
