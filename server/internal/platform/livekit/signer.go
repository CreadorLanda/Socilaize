// Package livekit signs join tokens for the self-hosted SFU.
//
// Extracted from the calls module because a live broadcast needs the same
// signature with a different set of rights: a call is everyone publishing to
// everyone, a live is one person publishing to an audience that cannot. The
// difference is three booleans, and duplicating the signing to express it
// would mean two places to get the permissions wrong.
package livekit

import (
	"time"

	"github.com/livekit/protocol/auth"
)

// TTL is how long a join token stays valid.
//
// Short on purpose. The token is fetched immediately before joining, so it
// never needs to outlive that; a long-lived one is a standing invitation to a
// room, sitting in whatever logs the request passed through.
const TTL = 5 * time.Minute

type Config struct {
	URL       string
	APIKey    string
	APISecret string
}

// Enabled reports whether the SFU is configured.
//
// Partial configuration counts as disabled: a URL with no signing key produces
// tokens the SFU rejects, which looks like a working feature right up to the
// moment it fails to connect.
func (c Config) Enabled() bool {
	return c.URL != "" && c.APIKey != "" && c.APISecret != ""
}

// Role is what someone may do inside a room.
//
// Named rather than passed as loose booleans, because "can publish" is the
// whole difference between a broadcaster and an audience, and a bool at a call
// site does not say which way round it goes.
type Role struct {
	// Publish allows sending audio and video. False for a viewer, and that is
	// the enforcement — the SFU refuses the track, so an audience member cannot
	// appear in a broadcast by patching the app.
	Publish bool
	// Subscribe allows receiving. A broadcaster still subscribes: a live with
	// two hosts is two people who need to hear each other.
	Subscribe bool
	// Data allows the side channel — reactions, chat, "the host ended it".
	Data bool
}

// Broadcaster publishes and hears the others.
var Broadcaster = Role{Publish: true, Subscribe: true, Data: true}

// Viewer watches. It cannot publish anything, which is what makes an audience
// an audience rather than a very large call.
var Viewer = Role{Publish: false, Subscribe: true, Data: true}

type Signer struct{ cfg Config }

func NewSigner(cfg Config) *Signer { return &Signer{cfg: cfg} }

func (s *Signer) Enabled() bool { return s.cfg.Enabled() }
func (s *Signer) URL() string   { return s.cfg.URL }

// Sign issues a token for one identity, in one room, with one role.
//
// Never grants room administration. A participant who could create rooms or
// evict others would be an admin of every room they join.
func (s *Signer) Sign(identity, name, room string, role Role) (string, time.Time, error) {
	at := auth.NewAccessToken(s.cfg.APIKey, s.cfg.APISecret).
		SetIdentity(identity).
		SetName(name).
		SetValidFor(TTL).
		SetVideoGrant(&auth.VideoGrant{
			Room:           room,
			RoomJoin:       true,
			CanPublish:     &role.Publish,
			CanSubscribe:   &role.Subscribe,
			CanPublishData: &role.Data,
		})
	token, err := at.ToJWT()
	if err != nil {
		return "", time.Time{}, err
	}
	return token, time.Now().Add(TTL), nil
}
