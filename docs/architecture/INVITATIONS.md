# Invitations & members (Phase 10 — first part)

## Flow
Owner/Admin creates an invitation (role, optional email, optional tree person) → gets a link once → invitee opens `/invite/<token>` →
registers or logs in (the `next` parameter brings them back) → **Accept** → becomes a FamilyMember and, if a person was chosen, the account is linked to that person.

## Security rules
- Token = 256-bit random; only HMAC-SHA256 (with `AUTH_SECRET`) is stored. Link is shown once. Expires in 7 days; single use (atomic PENDING → ACCEPTED); can be revoked.
- **Email-bound invitation:** only the *verified* owner of that email can accept it. **ADMIN invitations must be email-bound** and only the OWNER can create them.
- Link-only invitations (anyone holding the link) are limited to VIEWER / CONTRIBUTOR / EDITOR.
- OWNER role cannot be granted, changed or removed. Admins cannot change/remove other admins.
- Anyone can leave a family (except the owner). Removing a member keeps all people/data; the account↔person link is cleared.
- Limits: 50 members, 50 pending invitations per family; rate limits on create / preview / accept.
- Open-redirect safe: `?next=` accepts same-site paths only.

## API
`POST/GET /families/:id/invitations` · `DELETE /invitations/:id` · `GET /invite/:token` (public preview) · `POST /invite/:token/accept`
`GET /families/:id/members` · `PATCH/DELETE /families/:id/members/:userId`

## Not yet
QR code, ownership transfer, notifications ("X joined"), invitation emails in languages other than Uzbek.
