<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Candidate extends Model
{
    /** @use HasFactory<\Database\Factories\CandidateFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'category_id',
        'first_name',
        'last_name',
        'public_number',
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

        return $this->buildPublicUrl($path);
    }

    public function getPhotoUrlsAttribute(): array
    {
        $urls = [];

        foreach ((array) ($this->photo_variants ?? []) as $variant => $path) {
            if ($path) {
                $urls[$variant] = $this->buildPublicUrl($path);
            }
        }

        if (!isset($urls['large']) && !empty($this->attributes['photo_path'] ?? null)) {
            $urls['large'] = $this->buildPublicUrl($this->attributes['photo_path']);
        }

        if (!empty($this->attributes['photo_original_path'] ?? null)) {
            $urls['original'] = $this->buildPublicUrl($this->attributes['photo_original_path']);
        }

        return $urls;
    }

    public function getVideoUrlAttribute(): ?string
    {
        return $this->buildPublicUrl($this->video_path);
    }

    private function buildPublicUrl(?string $path): ?string
    {
        if (!$path) {
            return null;
        }
        if (str_starts_with($path, 'http')) {
            return $path;
        }
        if (str_starts_with($path, '/storage')) {
            return url($path);
        }
        return asset('storage/' . ltrim($path, '/'));
    }
}
