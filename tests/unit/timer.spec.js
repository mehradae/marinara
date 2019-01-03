import { assert } from 'chai';
import { Phase, PomodoroTimer } from '@/background/Timer';

PomodoroTimer.prototype.expired = function() {
  return new Promise(resolve => this.once('timer:expire', resolve));
};

describe('PomodoroTimer', () => {
  it('starts in the initial phase', async () => {
    let settings = {
      focus: { duration: 0 },
      shortBreak: { duration: 0 },
      longBreak: { interval: null }
    };

    let timer = new PomodoroTimer(settings, Phase.Focus);
    assert.equal(timer.phase, Phase.Focus);
    assert.equal(timer.nextPhase, Phase.ShortBreak);
  });

  it('does not advance until timer expires', async () => {
    let settings = {
      focus: { duration: 100 },
      shortBreak: { duration: 0 },
      longBreak: { interval: null }
    };

    let timer = new PomodoroTimer(settings, Phase.Focus);
    timer.start();
    timer.stop();
    assert.equal(timer.phase, Phase.Focus);
  });

  it('cycles between focus and short break', async () => {
    let settings = {
      focus: { duration: 0 },
      shortBreak: { duration: 0 },
      longBreak: { interval: null }
    };

    let timer = new PomodoroTimer(settings, Phase.Focus);
    for (let i = 0; i < 5; ++i) {
      timer.start();
      await timer.expired();
      assert.equal(timer.phase, Phase.Focus);

      timer.start();
      await timer.expired();
      assert.equal(timer.phase, Phase.ShortBreak);
    }
  });

  it('cycles between focus, short break, and long break', async () => {
    let settings = {
      focus: { duration: 0 },
      shortBreak: { duration: 0 },
      longBreak: { duration: 0, interval: 2 }
    };

    let timer = new PomodoroTimer(settings, Phase.Focus);
    assert.equal(timer.phase, Phase.Focus);

    for (let i = 0; i < 5; ++i) {
      timer.start();
      await timer.expired();
      assert.equal(timer.phase, Phase.Focus);
      assert.equal(timer.nextPhase, Phase.ShortBreak);

      timer.start();
      await timer.expired();
      assert.equal(timer.phase, Phase.ShortBreak);
      assert.equal(timer.nextPhase, Phase.Focus);

      timer.start();
      await timer.expired();
      assert.equal(timer.phase, Phase.Focus);
      assert.equal(timer.nextPhase, Phase.LongBreak);

      timer.start();
      await timer.expired();
      assert.equal(timer.phase, Phase.LongBreak);
      assert.equal(timer.nextPhase, Phase.Focus);
    }
  });

  it('can be set to long break', async () => {
    let settings = {
      focus: { duration: 0 },
      shortBreak: { duration: 0 },
      longBreak: { duration: 0, interval: 2 }
    };

    let timer = new PomodoroTimer(settings, Phase.Focus);
    timer.phase = Phase.LongBreak;
    assert.equal(timer.phase, Phase.LongBreak);
    assert.equal(timer.nextPhase, Phase.Focus);
  });

  it('only counts complete Pomodoros towards long break', async () => {
    let settings = {
      focus: { duration: 0 },
      shortBreak: { duration: 0 },
      longBreak: { duration: 100, interval: 2 }
    };

    let timer = new PomodoroTimer(settings, Phase.Focus);

    // Run full focus.
    timer.start();
    await timer.expired();

    // Run full short break.
    timer.start();
    await timer.expired();

    // Run full focus.
    timer.start();
    await timer.expired();

    // Run partial long break, then stop.
    assert.equal(timer.nextPhase, Phase.LongBreak);
    timer.start();
    timer.stop();

    // Force reset to focus, then run full focus.
    timer.phase = Phase.Focus;
    timer.start();
    await timer.expired();

    // Pomodoros until long break should have been reset,
    // so next phase should be a short break.
    assert.equal(timer.nextPhase, Phase.ShortBreak);
  });

  it('should reset cycle', async () => {
    let settings = {
      focus: { duration: 0 },
      shortBreak: { duration: 0 },
      longBreak: { duration: 0, interval: 2 }
    };

    let timer = new PomodoroTimer(settings, Phase.Focus);

    timer.start();
    await timer.expired();
    assert.equal(timer.phase, Phase.Focus);
    assert.equal(timer.nextPhase, Phase.ShortBreak);

    timer.startCycle();
    assert.equal(timer.phase, Phase.Focus);
    await timer.expired();
    assert.equal(timer.phase, Phase.Focus);
    assert.equal(timer.nextPhase, Phase.ShortBreak);
  });

  it('updates timer duration when settings change', async () => {
    let settings = {
      focus: { duration: 5 },
      shortBreak: { duration: 0 },
      longBreak: { duration: 0, interval: 2 }
    };

    let timer = new PomodoroTimer(settings, Phase.Focus);

    timer.start();
    assert.isAtLeast(timer.timeRemaining, 4 * 60);
    timer.stop();

    settings.focus.duration = 100;
    timer.startCycle();
    assert.isAtLeast(timer.timeRemaining, 99 * 60);
    timer.stop();
  });

  it('updates phases when long break is disabld', async () => {
    let settings = {
      focus: { duration: 0 },
      shortBreak: { duration: 0 },
      longBreak: { duration: 0, interval: 2 }
    };

    let timer = new PomodoroTimer(settings, Phase.Focus);

    // Run focus, short break, focus.
    timer.start();
    await timer.expired();
    timer.start();
    await timer.expired();
    timer.start();
    await timer.expired();

    // Next phase should be long break.
    assert.equal(timer.phase, Phase.Focus);
    assert.equal(timer.nextPhase, Phase.LongBreak);

    // Disable long breaks. The next phase should now be a short break.
    settings.longBreak.interval = null;
    assert.equal(timer.phase, Phase.Focus);
    assert.equal(timer.nextPhase, Phase.ShortBreak);

    timer.start();
    await timer.expired();
    assert.equal(timer.phase, Phase.ShortBreak);
    assert.equal(timer.nextPhase, Phase.Focus);
  });

  it('updates phases when long break is enabled', async () => {
    let settings = {
      focus: { duration: 0 },
      shortBreak: { duration: 0 },
      longBreak: { duration: 0, interval: null }
    };

    let timer = new PomodoroTimer(settings, Phase.Focus);

    // Run focus, short break, focus.
    timer.start();
    await timer.expired();
    timer.start();
    await timer.expired();
    timer.start();
    await timer.expired();

    // Next phase should be short break.
    assert.equal(timer.phase, Phase.Focus);
    assert.equal(timer.nextPhase, Phase.ShortBreak);

    // Enable long breaks. The next phase should now be a long break.
    settings.longBreak.interval = 2;
    assert.equal(timer.phase, Phase.Focus);
    assert.equal(timer.nextPhase, Phase.LongBreak);

    timer.start();
    await timer.expired();
    assert.equal(timer.phase, Phase.LongBreak);
    assert.equal(timer.nextPhase, Phase.Focus);
  });
});
