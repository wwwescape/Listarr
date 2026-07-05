"""add refresh_tokens, drop sessions

Revision ID: 0afbf7ab3597
Revises: 5bd98fadc19f
Create Date: 2026-07-04 08:32:00.323001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

import app.db.types

# revision identifiers, used by Alembic.
revision: str = '0afbf7ab3597'
down_revision: Union[str, Sequence[str], None] = '5bd98fadc19f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# NOTE: autogenerate also proposed a long list of op.alter_column calls across
# every existing table (TEXT->String, DATETIME->UTCDateTime, INTEGER->Boolean,
# etc.) plus FK/unique-constraint recreation. Those are all cosmetic —
# SQLite's loose column-type affinity vs. the ORM's declared types, present
# since the baseline migration and not something this (or any) migration
# needs to "fix". Stripped out deliberately; only the two real changes below
# (add RefreshTokens, drop Sessions) belong to this revision.


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('RefreshTokens',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('jti', sa.String(length=36), nullable=False),
    sa.Column('expires_at', app.db.types.UTCDateTime(), nullable=False),
    sa.Column('revoked_at', app.db.types.UTCDateTime(), nullable=True),
    sa.Column('created_at', app.db.types.UTCDateTime(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['Users.id'], name=op.f('fk_RefreshTokens_user_id_Users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_RefreshTokens')),
    sa.UniqueConstraint('jti', name=op.f('uq_RefreshTokens_jti'))
    )
    op.create_index(op.f('ix_RefreshTokens_user_id'), 'RefreshTokens', ['user_id'], unique=False)
    op.drop_table('Sessions')


def downgrade() -> None:
    """Downgrade schema."""
    op.create_table('Sessions',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('userId', sa.Integer(), nullable=False),
    sa.Column('createdAt', app.db.types.UTCDateTime(), nullable=False),
    sa.Column('updatedAt', app.db.types.UTCDateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_Sessions'))
    )
    op.drop_index(op.f('ix_RefreshTokens_user_id'), table_name='RefreshTokens')
    op.drop_table('RefreshTokens')
