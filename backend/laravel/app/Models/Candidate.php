<?php

namespace App\Models;

use App\Support\MediaUrl;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Candidate extends Model
{
    /** @use HasFactory<\Database\Factories\CandidateFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'category_id',
        'first_name',
        'last_name',
        'public_number',
        'public_uid',
        'slug',
        'email',
        'phone',
        'bio',
        'description',
        'city',
        'photo_path',
        'photo_original_path',
        'photo_variants',
        'photo_meta',
        'photo_processing_status',
        'photo_processing_error',
        'video_path',
        'video_meta',
        'age',
        'university',
        'is_active',
        'status',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'photo_variants' => 'array',
        'photo_meta' => 'array',
        'video_meta' => 'array',
    ];

    protected $appends = [
        'photo_url',
        'photo_urls',
        'video_url',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $candidate): void {
            $candidate->ensurePublicIdentity();
        });

        static::saving(function (self $candidate): void {
            $candidate->ensurePublicIdentity();
        });
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function votes()
    {
        return $this->hasMany(Vote::class);
    }

    public function user()
    {
        return $this->hasOne(User::class);
    }

    public function getPhotoUrlAttribute(): ?string
    {
        $variants = $this->photo_variants ?? [];
        $path = $variants['large'] ?? ($this->attributes['photo_path'] ?? null);

        return MediaUrl::fromPath($path);
    }

    public function getPhotoUrlsAttribute(): array
    {
        $urls = [];

        foreach ((array) ($this->photo_variants ?? []) as $variant => $path) {
            if ($path) {
                $urls[$variant] = MediaUrl::fromPath($path);
            }
        }

        if (!isset($urls['large']) && !empty($this->attributes['photo_path'] ?? null)) {
            $urls['large'] = MediaUrl::fromPath($this->attributes['photo_path']);
        }

        if (!empty($this->attributes['photo_original_path'] ?? null)) {
            $urls['original'] = MediaUrl::fromPath($this->attributes['photo_original_path']);
        }

        return $urls;
    }

    public function getVideoUrlAttribute(): ?string
    {
        return MediaUrl::fromPath($this->video_path);
    }

    public function ensurePublicIdentity(): void
    {
        if (blank($this->public_uid)) {
            $this->public_uid = static::generateUniquePublicUid($this->id);
        }

        if (blank($this->slug)) {
            $this->slug = static::generateUniqueSlug(
                trim(($this->first_name ?? '') . ' ' . ($this->last_name ?? '')),
                $this->id
            );
        }
    }

    public static function generateUniquePublicUid(?int $ignoreId = null): string
    {
        do {
            $value = (string) Str::ulid();

            $exists = static::withTrashed()
                ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
                ->where('public_uid', $value)
                ->exists();
        } while ($exists);

        return $value;
    }

    public static function generateUniqueSlug(string $baseName, ?int $ignoreId = null): string
    {
        $base = Str::slug($baseName);
        $base = $base !== '' ? $base : 'candidate';

        do {
            $suffix = Str::lower(Str::random(10));
            $value = Str::limit($base . '-' . $suffix, 255, '');

            $exists = static::withTrashed()
                ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
                ->where('slug', $value)
                ->exists();
        } while ($exists);

        return $value;
    }
}
