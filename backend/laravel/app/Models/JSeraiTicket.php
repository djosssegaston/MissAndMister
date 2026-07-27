<?php

namespace App\Models;

use App\Support\MediaUrl;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class JSeraiTicket extends Model
{
    protected $fillable = [
        'uuid',
        'first_name',
        'last_name',
        'phone',
        'email',
        'photo_path',
        'poster_path',
        'edit_token',
        'template_id',
        'status',
        'downloaded_at',
    ];

    protected $casts = [
        'phone' => 'encrypted',
        'email' => 'encrypted',
        'downloaded_at' => 'datetime',
    ];

    protected $appends = [
        'photo_url',
        'poster_url',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $ticket): void {
            if (blank($ticket->uuid)) {
                $ticket->uuid = (string) Str::uuid();
            }

            if (blank($ticket->edit_token)) {
                $ticket->edit_token = Str::random(64);
            }

            if (blank($ticket->status)) {
                $ticket->status = 'draft';
            }
        });
    }

    public function template()
    {
        return $this->belongsTo(JSeraiTemplate::class);
    }

    public function getPhotoUrlAttribute(): ?string
    {
        return MediaUrl::fromPath($this->photo_path);
    }

    public function getPosterUrlAttribute(): ?string
    {
        return MediaUrl::fromPath($this->poster_path);
    }

    public function isEditable(): bool
    {
        return $this->status === 'draft' || $this->status === 'completed';
    }

    public function isDownloaded(): bool
    {
        return $this->status === 'downloaded';
    }

    public function scopeActive($query)
    {
        return $query->whereIn('status', ['draft', 'completed']);
    }
}
