import { Container } from "pixi.js";
import { LoadingStar } from "../components/LoadingStar";
import { ProgressBar } from "../components/ProgressBar";
import { LoadingLabel } from "../components/LoadingLabel";
import { LoadingTitle } from "../components/LoadingTitle";

type LoadingSceneOptions = {
  onComplete?: () => void;
};

export class LoadingScene extends Container {
  private readonly star: LoadingStar;
  private readonly bar: ProgressBar;
  private readonly loadingLabel: LoadingLabel;
  private readonly title: LoadingTitle;
  private readonly onComplete?: () => void;

  private progress = 0;
  private completed = false;

  constructor(options: LoadingSceneOptions = {}) {
    super();
    this.onComplete = options.onComplete;

    this.star = new LoadingStar(36);
    this.bar = new ProgressBar();
    this.loadingLabel = new LoadingLabel();
    this.title = new LoadingTitle();

    this.addChild(this.star, this.bar, this.loadingLabel, this.title);
  }

  layout(screenWidth: number, screenHeight: number): void {
    const cx = screenWidth / 2;
    const cy = screenHeight / 2;

    this.star.position.set(cx, cy - 30);
    this.bar.position.set(cx, cy + 30);
    this.loadingLabel.position.set(cx, cy + 60);
    this.title.position.set(cx, cy + 160);
  }

  update(deltaTime: number): void {
    this.star.update(deltaTime);
    this.loadingLabel.update(deltaTime);
  }

  setProgress(progress: number): void {
    if (this.completed) {
      return;
    }

    this.progress = Math.max(0, Math.min(1, progress));
    this.bar.setProgress(this.progress);
  }

  complete(): void {
    if (this.completed) {
      return;
    }

    this.progress = 1;
    this.bar.setProgress(this.progress);
    this.completed = true;
    this.onComplete?.();
  }
}
