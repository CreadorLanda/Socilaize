# 🎖️ Badges & Verification

> Complete documentation for user badges, verification levels, and achievements.

---

## Overview

| Category | Type | How to Get |
|----------|------|-----------|
| Verification | Normal | Application |
| Verification | Creator | Request + Review |
| Badge | Contributor | Activity-based |
| Badge | Game Creator | Create games |
| Badge | Secret | Rare events |
| Badge | Super Rare | Limited editions |

---

## 1. Verification Levels

### 1.1 Normal Verification ✅

**Requirements:**
- Active account (>30 days)
- Phone verified
- Minimum followers: 100

**Badge:** ✅ Blue checkmark

**Cost:** Free

---

### 1.2 Creator Verification 🎮

**Requirements:**
- Normal verification
- Content creator (videos, streams)
- Active community
- Application review

**Badge:** 🎮 Gaming controller icon

**Cost:** Free (review process)

---

### 1.3 "Rei" (King) 👑

**Special badge for founding users or special recognition.**

**Requirements:**
- Early adopter
- Or special recognition from team
- Invitation-only

**Badge:** 👑 Crown icon

---

## 2. Paid Badges

### 2.1 Monthly Subscription ($5)

**Benefits:**
- Premium badge
- Profile glow effect
- Custom emoji in comments
- Early access features

**Badge:** ⭐ Star with "Pro" text

**Cost:** $5/month

---

### 2.2 One-Time Payment ($5)

**Benefit:** Permanent premium badge

**Badge:** 💎 Diamond icon

**Cost:** $5 (one-time)

---

## 3. Activity-Based Badges

### 3.1 Contributor Badge

**Earned through:**
- Helping users in community
- Reporting bugs
- Contributing to app growth

**Levels:**
| Type | Requirement | Badge |
|------|-------------|-------|
| Helper | 50+ helpful responses | 🌟 |
| Reporter | 10+ bug reports | 🐛 |
| Supporter | 100+ referrals | 💪 |

---

### 3.2 Game Creator Badge

**Requirements:**
- Create a mini-game
- Game approved by team
- Active game with users

**Badge:** 🎲 Dice with star

---

### 3.3 Streak Badges

| Days | Badge |
|------|-------|
| 7 | 🔥 7-day streak |
| 30 | 🔥 30-day streak |
| 100 | 🔥 100-day streak |
| 365 | 🔥 1-year streak |

---

## 4. Secret & Rare Badges

### 4.1 Secret Badges

**How to get:** Hidden achievements

| Badge | Requirement |
|-------|-------------|
| 🎁 First gift sent | Send a gift |
| 🎭 First mask used | Use mask feature |
| 🌙 Night owl | Use app at 3am |

---

### 4.2 Super Rare Badges

**Limited editions - very hard to obtain:**

| Badge | Requirement |
|-------|-------------|
| 🏆 Founder | One of first 100 users |
| 👑 Legacy | Invitation-only |
| 🌟 Unicorn | 1000+ referrals |
| 💎 Diamond Hands | Hold premium 2+ years |

---

## 5. Badge Display

### Profile Badge Slots

- Main badge (1): Shown next to username
- Sub-badges (3): Shown on profile

---

## 6. Badge API

```http
GET /api/users/:id/badges

Response:
{
  "main_badge": "verified",
  "sub_badges": ["contributor", "100_day_streak"],
  "available": ["game_creator", "premium"]
}
```

```http
PUT /api/users/me/badges
{
  "main_badge": "verified",
  "sub_badges": ["contributor", "premium"]
}
```

---

## 7. Badge Shop

```http
GET /api/badges/shop
```

---

## 8. Verification Application

```http
POST /api/verification/apply
{
  "type": "normal" | "creator",
  "bio": "Why I should be verified",
  "links": ["website", "social"]
}
```
