-- Audience roles for a post, displayed as the "Ideal for" label in post cards.
-- Existing posts remain valid and start with no audience specified.
ALTER TABLE posts ADD COLUMN ideal_for VARCHAR(300) NOT NULL DEFAULT '';
