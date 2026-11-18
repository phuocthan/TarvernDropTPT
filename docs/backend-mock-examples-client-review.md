# Existing mock API examples — annotated for KRW/resume review

The historical fixtures below preserve the original mock payloads. The revised wire proposal uses a flat numeric `reels` array in row order and `winLines[].winSym` with 1-based cell positions. See the mapping and worked example in [the current API flow](game-and-api-flow-krw.md#format-reels-và-winlines).

**Client review copy; current mock, not the agreed production contract.** These are the existing sanitized synthetic fixtures from [milestone-1-api-examples.json](milestone-1-api-examples.json). They use the old demonstration scale of 2, no currency code and in-memory state; they are **not KRW examples**. For KRW, the customer's proposed setting is currency = "KRW", currencyExponent = 0; 1000 minor units means ₩1,000. Do not convert or relabel these historical numbers as KRW.

The mock can credit a base win before the feature and credit the feature later. It does **not** yet implement the agreed one final payout for the complete paid round, durable recovery, the 10,000× cap or payment status. Current Tavern config uses 5,000×. The API and field changes in [the KRW/resume proposal](backend-requirements-krw-resume-single-settlement.md) are recommendations for A's review, not live behavior.

## 1. Session / init

GET /api/session; HTTP 200.

**Existing response**

```json
{
  "version": 0,
  "balance": 100000,
  "board": [
    [
      "A",
      "ale",
      "K",
      "coin",
      "J"
    ],
    [
      "barrel",
      "Q",
      "wild",
      "J",
      "A"
    ],
    [
      "K",
      "coin",
      "bonus",
      "ale",
      "Q"
    ],
    [
      "Q",
      "ale",
      "A",
      "crown",
      "K"
    ],
    [
      "crown",
      "J",
      "coin",
      "Q",
      "barrel"
    ]
  ],
  "feature": null,
  "round": null
}
```

**Missing / review**

No contract version, currency, exponent, configurable bets/charges or payment status. This is a new session snapshot, not an authenticated durable account/recovery protocol.

## 2. Normal spin

POST /api/command; HTTP 200.

**Existing request**

```json
{
  "requestId": "example-001",
  "expectedVersion": 0,
  "action": "spin",
  "bet": 100,
  "chance": "standard"
}
```

**Existing response**

```json
{
  "requestId": "example-001",
  "bet": 100,
  "state": {
    "version": 1,
    "balance": 99920,
    "board": [
      [
        "A",
        "K",
        "Q",
        "J",
        "10"
      ],
      [
        "A",
        "10",
        "coin",
        "ale",
        "J"
      ],
      [
        "A",
        "crown",
        "barrel",
        "coin",
        "Q"
      ],
      [
        "K",
        "10",
        "coin",
        "J",
        "ale"
      ],
      [
        "Q",
        "J",
        "10",
        "coin",
        "barrel"
      ]
    ],
    "feature": null,
    "round": null
  },
  "wins": [
    {
      "line": 0,
      "symbol": "A",
      "positions": [
        {
          "reel": 0,
          "row": 0
        },
        {
          "reel": 1,
          "row": 0
        },
        {
          "reel": 2,
          "row": 0
        }
      ],
      "amount": 20
    }
  ],
  "spinWin": 20,
  "entry": null,
  "retrigger": 0,
  "collected": [],
  "completion": null,
  "finalFeature": null,
  "paidAward": 20,
  "capped": false
}
```

**Missing / review**

Missing explicit currency/exponent, authoritative charged amount, payment status/receipt, released-versus-presented checkpoints and durable outcome ID. `spinWin` describes the spin; `paidAward` is the amount credited by this mock command. This old base-win credit behavior must not be presented as the agreed one-final-settlement design.

## 3. Bonus entry / progression

POST /api/command; HTTP 200.

**Existing request**

```json
{
  "requestId": "example-002",
  "expectedVersion": 1,
  "action": "buy-drop",
  "bet": 100,
  "chance": "standard"
}
```

**Existing response**

```json
{
  "requestId": "example-002",
  "bet": 100,
  "state": {
    "version": 2,
    "balance": 89920,
    "board": [
      [
        "bonus",
        "A",
        "A",
        "A",
        "A"
      ],
      [
        "bonus",
        "A",
        "A",
        "A",
        "A"
      ],
      [
        "bonus",
        "A",
        "A",
        "A",
        "A"
      ],
      [
        "bonus",
        "A",
        "A",
        "A",
        "A"
      ],
      [
        "A",
        "A",
        "A",
        "A",
        "A"
      ]
    ],
    "feature": {
      "mode": "drop",
      "remaining": 10,
      "played": 0,
      "accumulated": 0,
      "chests": [
        {
          "rows": [],
          "unlocked": false,
          "multiplier": null
        },
        {
          "rows": [],
          "unlocked": false,
          "multiplier": null
        },
        {
          "rows": [],
          "unlocked": false,
          "multiplier": null
        },
        {
          "rows": [],
          "unlocked": false,
          "multiplier": null
        },
        {
          "rows": [],
          "unlocked": false,
          "multiplier": null
        }
      ]
    },
    "round": {
      "id": "00000000-0000-4000-8000-000000000001",
      "bet": 100,
      "baseWin": 0,
      "cap": 500000
    }
  },
  "wins": [],
  "spinWin": 0,
  "entry": "drop",
  "retrigger": 0,
  "collected": [],
  "completion": null,
  "finalFeature": null,
  "paidAward": 0,
  "capped": false
}
```

**Missing / review**

This existing entry response shows the initial feature and empty keys. A complete intermediate free-spin request/response pair is not supplied in this fixture set; `resumeBeforeFinalSpin` below shows a seeded mid-feature snapshot, not a presentation-progress ACK. Missing durable released and presented cursors, explicit client presentation checkpoint, payment status and the proposed single `chest` multiplier array.

## 4. Resume before the final free spin

GET /api/session; HTTP 200.

**Existing response**

```json
{
  "version": 2,
  "balance": 89920,
  "board": [
    [
      "bonus",
      "A",
      "A",
      "A",
      "A"
    ],
    [
      "bonus",
      "A",
      "A",
      "A",
      "A"
    ],
    [
      "bonus",
      "A",
      "A",
      "A",
      "A"
    ],
    [
      "bonus",
      "A",
      "A",
      "A",
      "A"
    ],
    [
      "A",
      "A",
      "A",
      "A",
      "A"
    ]
  ],
  "feature": {
    "mode": "drop",
    "remaining": 1,
    "played": 9,
    "accumulated": 400,
    "chests": [
      {
        "rows": [
          1,
          2,
          3,
          4
        ],
        "unlocked": false,
        "multiplier": null
      },
      {
        "rows": [],
        "unlocked": false,
        "multiplier": null
      },
      {
        "rows": [],
        "unlocked": false,
        "multiplier": null
      },
      {
        "rows": [],
        "unlocked": false,
        "multiplier": null
      },
      {
        "rows": [],
        "unlocked": false,
        "multiplier": null
      }
    ]
  },
  "round": {
    "id": "00000000-0000-4000-8000-000000000001",
    "bet": 100,
    "baseWin": 0,
    "cap": 500000
  }
}
```

**Missing / review**

This is a seeded snapshot with nine spins played, one remaining and four keys on reel 0. The mock can restore only while its in-memory session lives. It does not include snapshot-at-presented versus server-released cursor, replay payload for an interrupted animation, or recovery after server restart/session loss. Do not claim a completed-animation checkpoint from this snapshot.

## 5. Final free spin / chest result

POST /api/command; HTTP 200.

**Existing request**

```json
{
  "requestId": "example-003",
  "expectedVersion": 2,
  "action": "spin",
  "bet": 100,
  "chance": "standard"
}
```

**Existing response**

```json
{
  "requestId": "example-003",
  "bet": 100,
  "state": {
    "version": 3,
    "balance": 92020,
    "board": [
      [
        "A",
        "K",
        "Q",
        "J",
        "10"
      ],
      [
        "A",
        "10",
        "coin",
        "ale",
        "J"
      ],
      [
        "A",
        "crown",
        "barrel",
        "coin",
        "Q"
      ],
      [
        "K",
        "10",
        "coin",
        "J",
        "ale"
      ],
      [
        "Q",
        "J",
        "10",
        "coin",
        "barrel"
      ]
    ],
    "feature": null,
    "round": null
  },
  "wins": [
    {
      "line": 0,
      "symbol": "A",
      "positions": [
        {
          "reel": 0,
          "row": 0
        },
        {
          "reel": 1,
          "row": 0
        },
        {
          "reel": 2,
          "row": 0
        }
      ],
      "amount": 20
    }
  ],
  "spinWin": 20,
  "entry": null,
  "retrigger": 0,
  "collected": [
    {
      "reel": 0,
      "row": 0
    },
    {
      "reel": 1,
      "row": 0
    },
    {
      "reel": 2,
      "row": 0
    }
  ],
  "completion": {
    "accumulated": 420,
    "multipliers": [
      5,
      1,
      1,
      1,
      1
    ],
    "product": 5,
    "featureAward": 2100,
    "roundAward": 2100,
    "capped": false
  },
  "finalFeature": {
    "mode": "drop",
    "remaining": 0,
    "played": 10,
    "accumulated": 420,
    "chests": [
      {
        "rows": [
          0,
          1,
          2,
          3,
          4
        ],
        "unlocked": true,
        "multiplier": 5
      },
      {
        "rows": [
          0
        ],
        "unlocked": false,
        "multiplier": 1
      },
      {
        "rows": [
          0
        ],
        "unlocked": false,
        "multiplier": 1
      },
      {
        "rows": [],
        "unlocked": false,
        "multiplier": 1
      },
      {
        "rows": [],
        "unlocked": false,
        "multiplier": 1
      }
    ]
  },
  "paidAward": 2100,
  "capped": false
}
```

**Missing / review**

This fixture records accumulated 420, multipliers [5,1,1,1,1], feature award 2100 and immediate mock feature credit. The current mock uses `finalFeature.chests` and `completion.multipliers`, not the requested `chest` array on every spin. Missing final round settlement status/receipt, durable progress checkpoints and the 10,000× cap. Base win is zero here, so this fixture does not demonstrate single settlement including a nonzero base win.

## 6. Completion and payment-status handling

The existing mock has **no endpoint or response** for durable settlement status, a wallet receipt or presentation completion. In the previous response, `paidAward` and `state.balance` are mock values, not an authoritative asynchronous payment-status contract. Proposed pending/paid status examples appear in [section 7.6 of the KRW/resume draft](backend-requirements-krw-resume-single-settlement.md); their enum, credit timing, receipt semantics and zero-win handling remain for A to define.

## 7. Release, presentation and request frequency

The existing mock provides the outcome and snapshot but does not persist a presentation cursor. Receiving an outcome is **not evidence that its animation completed**. A server-confirmed presentation checkpoint, stable step IDs, safe recovery boundaries and conflict/retry behavior are proposed in the KRW/resume draft and require joint review. Customer requires completed free spins not to restart; the crash window between visual completion and durable ACK remains an open design problem, not permission to replay completed spins.

Currently the mock uses one `POST /api/command` per spin, including free spins. The proposed integration may batch release and combine checkpoint ACK with next-step fetch, but neither exact endpoint count nor ACK frequency has been agreed; no per-frame calls are required. A must guarantee outcome/winnings and server-side settlement independently of a client returning or sending animation-complete.

Skip/Turbo change presentation timing, not outcome or wallet values. Team A owns outcome, wallet and server recovery; the client owns presentation and checkpoint behavior. The versioned target contract, KRW formatting, rounding, bet steps, settlement trigger and exact cursor semantics need A/customer review.
