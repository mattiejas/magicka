package game

import (
	"regexp"
	"strings"
	"unicode/utf8"

	"driftwake/content"
	"driftwake/server/internal/pb"

	"google.golang.org/protobuf/proto"
)

var nameRE = regexp.MustCompile(`^[A-Za-z0-9_]{3,16}$`)

// Decode parses a browser's message and refuses anything malformed or out of range.
func Decode(b []byte) (*pb.ClientMessage, bool) {
	msg := &pb.ClientMessage{}
	if proto.Unmarshal(b, msg) != nil {
		return nil, false
	}
	slot := func(v uint32) bool { return v < content.InvSize }
	qty := func(v, hi uint32) bool { return v >= 1 && v <= hi }
	password := func(pw string) bool {
		n := utf8.RuneCountInString(pw)
		return n >= 8 && n <= 128
	}
	cred := func(c *pb.Credentials) bool {
		return nameRE.MatchString(c.GetName()) && password(c.GetPassword())
	}
	ok := true
	switch m := msg.Msg.(type) {
	case nil:
		ok = false
	case *pb.ClientMessage_Register:
		ok = cred(m.Register)
	case *pb.ClientMessage_Login:
		ok = cred(m.Login)
	case *pb.ClientMessage_ChangePassword:
		ok = password(m.ChangePassword.GetOldPassword()) && password(m.ChangePassword.GetNewPassword())
	case *pb.ClientMessage_ResumeToken:
		ok = len(m.ResumeToken) == 64
	case *pb.ClientMessage_Move:
		ok = m.Move.GetX() < 256 && m.Move.GetY() < 256
	case *pb.ClientMessage_SetSail:
		ok = m.SetSail <= sailFull
	case *pb.ClientMessage_Steer:
		ok = m.Steer.GetX() < 256 && m.Steer.GetY() < 256
	case *pb.ClientMessage_Helm:
		ok = m.Helm >= -1 && m.Helm <= 1
	case *pb.ClientMessage_PickupAll:
		ok = m.PickupAll&kindMask == kindDrop
	case *pb.ClientMessage_Craft:
		ok = qty(m.Craft.GetQty(), 999)
	case *pb.ClientMessage_EquipSlot:
		ok = slot(m.EquipSlot)
	case *pb.ClientMessage_EatSlot:
		ok = slot(m.EatSlot)
	case *pb.ClientMessage_DropSlot:
		ok = slot(m.DropSlot)
	case *pb.ClientMessage_Swap:
		ok = slot(m.Swap.GetA()) && slot(m.Swap.GetB())
	case *pb.ClientMessage_Unequip:
		ok = m.Unequip >= pb.Slot_SLOT_WEAPON && m.Unequip <= pb.Slot_SLOT_CAPE
	case *pb.ClientMessage_Bank:
		ok = qty(m.Bank.GetQty(), 1_000_000)
	case *pb.ClientMessage_Shop:
		ok = qty(m.Shop.GetQty(), 1_000_000)
	case *pb.ClientMessage_TradeStep:
		a := m.TradeStep.GetAction()
		moves := a == pb.TradeAction_TRADE_ACTION_OFFER || a == pb.TradeAction_TRADE_ACTION_TAKE_BACK
		ok = a >= pb.TradeAction_TRADE_ACTION_OFFER && a <= pb.TradeAction_TRADE_ACTION_DECLINE &&
			(!moves || qty(m.TradeStep.GetQty(), 1_000_000))
	case *pb.ClientMessage_SellToTrader:
		ok = qty(m.SellToTrader, 1_000_000)
	case *pb.ClientMessage_Block:
		ok = nameRE.MatchString(m.Block.GetName())
	case *pb.ClientMessage_Report:
		r := m.Report.GetReason()
		ok = nameRE.MatchString(m.Report.GetName()) &&
			r >= pb.ReportReason_REPORT_REASON_LANGUAGE && r <= pb.ReportReason_REPORT_REASON_OTHER
	case *pb.ClientMessage_Look:
		ok = m.Look.GetCut() < uint32(content.Haircuts) && m.Look.GetColor() < uint32(content.HairColors)
	case *pb.ClientMessage_Chat:
		m.Chat = strings.TrimSpace(m.Chat)
		n := utf8.RuneCountInString(m.Chat)
		ok = n >= 1 && n <= 160
	}
	return msg, ok
}
